import "server-only";

import { PASS_LOOKUP_KEYS, purchaseOfPrice } from "@app/core";
import Stripe from "stripe";

// The few calls the House Pass makes to Stripe, behind one small interface,
// so the moves and the webhook can be tested against a stand-in. Stripe is
// optional: without STRIPE_SECRET_KEY the Pass is shown, not sold.

/** A house's subscription as the webhook needs it, read fresh from Stripe. */
export interface SubscriptionView {
  id: string;
  status: string;
  customer: string;
  metadata: Record<string, string>;
  /** The lookup key of its plan (PASS_LOOKUP_KEYS), also for a price whose key has since moved on. */
  lookupKey: string | null;
  /** Unix seconds: the end of the period paid for, or of the trial. */
  periodEnd: number;
  endedAt: number | null;
  /** Set to stop at the end of what was paid (the buyer cancelled, or the clock stopped it). */
  cancelAtPeriodEnd?: boolean;
}

export interface CheckoutParams {
  mode: "payment" | "subscription";
  price: string;
  currency: string;
  email: string | undefined;
  metadata: Record<string, string>;
  /** Unix seconds; a subscription bought during the free month first charges then. */
  trialEnd: number | null;
  successUrl: string;
  cancelUrl: string;
}

export interface PassStripe {
  /** The active price with this lookup key, or null. */
  priceId(lookupKey: string): Promise<string | null>;
  /** A Checkout Session's URL. */
  checkout(params: CheckoutParams): Promise<string>;
  /** A billing portal session's URL, for the buyer to change or cancel. */
  portal(customer: string, returnUrl: string): Promise<string>;
  subscription(id: string): Promise<SubscriptionView>;
  /** Stops a subscription renewing; it runs to the end of what was paid. */
  stopRenewing(id: string): Promise<void>;
  /** Undoes stopRenewing: it renews again at the end of the period. */
  resumeRenewing(id: string): Promise<void>;
}

/** Stripe's own client, or null when STRIPE_SECRET_KEY isn't set. */
export function stripeSdk(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

/** The PassStripe that talks to Stripe, or null when Stripe isn't set up. */
export function passStripe(sdk: Stripe | null = stripeSdk()): PassStripe | null {
  if (!sdk) return null;
  return {
    async priceId(lookupKey) {
      const prices = await sdk.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
      return prices.data[0]?.id ?? null;
    },

    async checkout(p) {
      const session = await sdk.checkout.sessions.create({
        mode: p.mode,
        line_items: [{ price: p.price, quantity: 1 }],
        currency: p.currency,
        customer_email: p.email,
        client_reference_id: p.metadata.house_id,
        metadata: p.metadata,
        ...(p.mode === "subscription"
          ? { subscription_data: { metadata: p.metadata, ...(p.trialEnd ? { trial_end: p.trialEnd } : {}) } }
          : { customer_creation: "always" as const, payment_intent_data: { metadata: p.metadata } }),
        allow_promotion_codes: true,
        success_url: p.successUrl,
        cancel_url: p.cancelUrl,
      });
      if (!session.url) throw new Error("Stripe returned a Checkout Session with no URL");
      return session.url;
    },

    async portal(customer, returnUrl) {
      const session = await sdk.billingPortal.sessions.create({ customer, return_url: returnUrl });
      return session.url;
    },

    async subscription(id) {
      const sub = await sdk.subscriptions.retrieve(id);
      const item = sub.items.data[0];
      const plan = item ? purchaseOfPrice(item.price) : null;
      return {
        id: sub.id,
        status: sub.status,
        customer: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        metadata: sub.metadata,
        lookupKey: plan ? PASS_LOOKUP_KEYS[plan] : null,
        periodEnd: item?.current_period_end ?? sub.ended_at ?? 0,
        endedAt: sub.ended_at,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };
    },

    async stopRenewing(id) {
      await sdk.subscriptions.update(id, { cancel_at_period_end: true });
    },

    async resumeRenewing(id) {
      await sdk.subscriptions.update(id, { cancel_at_period_end: false });
    },
  };
}
