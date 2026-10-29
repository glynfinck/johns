import "server-only";

import { passAfterSubscription, passFreeUntil, passOf, purchaseOfLookupKey, subscriptionLive, type HousePass } from "@app/core";
import type Stripe from "stripe";

import type { Stage } from "@/lib/env";
import type { AdminClient } from "@/lib/supabase/admin";

import type { PassStripe } from "./stripe";

/**
 * Stripe's word on a House Pass purchase, carried to the house: the webhook
 * (app/api/stripe/webhook) calls this with each event it has checked the
 * signature of. A subscription is always read again from Stripe rather than
 * taken from the event, so events arriving late or out of order still land
 * on how things stand now. The rules are @app/core's (passAfterSubscription).
 *
 * Staging and production can share a Stripe sandbox, and each has a webhook
 * on it, so both hear every purchase. A purchase carries the stage it was
 * made on (lib/moves/pass.ts) and only that stage acts on it; one from
 * before stages were tagged belongs to whichever copy has its house.
 *
 * Returns what it did, for the logs and the tests.
 */
export async function applyPassEvent(
  db: AdminClient,
  stripe: PassStripe,
  event: Stripe.Event,
  now: Date,
  stage: Stage,
): Promise<"founding" | "subscription" | "ignored"> {
  const ours = (metadata: Record<string, string> | null | undefined) => !metadata?.stage || metadata.stage === stage;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (!ours(session.metadata)) return "ignored";
      if (session.mode === "subscription" && typeof session.subscription === "string") {
        return syncSubscription(db, stripe, session.subscription, now, ours);
      }
      if (session.mode === "payment" && session.payment_status === "paid") {
        return giveFounding(db, stripe, session);
      }
      return "ignored";
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      return syncSubscription(db, stripe, event.data.object.id, now, ours);
    default:
      return "ignored";
  }
}

function idOf(customer: string | { id: string } | null): string | null {
  return typeof customer === "string" ? customer : (customer?.id ?? null);
}

async function writePass(db: AdminClient, houseId: string, pass: HousePass) {
  const { error } = await db
    .from("houses")
    .update({ pass_plan: pass.plan, pass_until: pass.until?.toISOString() ?? null, pass_buyer: pass.buyerId })
    .eq("id", houseId);
  if (error) throw new Error(`Couldn't write the House Pass: ${error.message}`);
}

async function writeBilling(db: AdminClient, houseId: string, customer: string, subscription: string | null) {
  const { error } = await db
    .from("house_pass_billing")
    .upsert({ house_id: houseId, stripe_customer: customer, stripe_subscription: subscription, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Couldn't write the House Pass billing: ${error.message}`);
}

/**
 * A Founding purchase paid: the house has the Pass for life. A plan it was
 * paying for stops renewing (it was paid to the end of its period), and
 * nothing that subscription does from here changes the house.
 */
async function giveFounding(db: AdminClient, stripe: PassStripe, session: Stripe.Checkout.Session) {
  const houseId = session.metadata?.house_id;
  const customer = idOf(session.customer);
  if (!houseId || !customer) return "ignored";

  const { data: billing } = await db.from("house_pass_billing").select("stripe_subscription").eq("house_id", houseId).maybeSingle();
  if (billing?.stripe_subscription) await stripe.stopRenewing(billing.stripe_subscription);

  await writeBilling(db, houseId, customer, null);
  await writePass(db, houseId, { plan: "founding", until: null, buyerId: session.metadata?.buyer ?? null });
  return "founding";
}

/**
 * A subscription changed: started, renewed, failed a payment, switched plan
 * or ended. A live one becomes the house's subscription; any other only
 * changes the house while it is the house's subscription, so an old one
 * ending after a new one started leaves the Pass alone.
 */
async function syncSubscription(
  db: AdminClient,
  stripe: PassStripe,
  subscriptionId: string,
  now: Date,
  ours: (metadata: Record<string, string>) => boolean,
) {
  const sub = await stripe.subscription(subscriptionId);
  if (!ours(sub.metadata)) return "ignored";
  const houseId = sub.metadata.house_id;
  const plan = purchaseOfLookupKey(sub.lookupKey);
  if (!houseId || !plan || plan === "founding") return "ignored";

  const [{ data: house }, { data: billing }] = await Promise.all([
    db.from("houses").select("created_at, pass_plan, pass_until, pass_buyer").eq("id", houseId).maybeSingle(),
    db.from("house_pass_billing").select("stripe_subscription").eq("house_id", houseId).maybeSingle(),
  ]);
  if (!house) return "ignored";

  const live = subscriptionLive(sub.status);
  if (!live && billing?.stripe_subscription !== sub.id) return "ignored";

  const next = passAfterSubscription(
    passOf(house),
    {
      plan,
      status: sub.status,
      periodEnd: new Date(sub.periodEnd * 1000),
      endedAt: sub.endedAt === null ? null : new Date(sub.endedAt * 1000),
      buyerId: sub.metadata.buyer ?? null,
    },
    passFreeUntil(new Date(house.created_at)),
    now,
  );
  if (!next) return "ignored";

  await writeBilling(db, houseId, sub.customer, live ? sub.id : null);
  await writePass(db, houseId, next);
  return "subscription";
}
