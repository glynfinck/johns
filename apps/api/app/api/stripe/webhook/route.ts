import { applyPassEvent } from "@/lib/pass/events";
import { passStripe, stripeSdk } from "@/lib/pass/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/stripe/webhook: Stripe tells the API about House Pass purchases
 * (lib/pass/events.ts). Called by Stripe alone, never by the app, so there's
 * no CORS and no sign-in: the signature, made with STRIPE_WEBHOOK_SECRET, is
 * what proves it's Stripe. A 500 makes Stripe send the event again later.
 */
export async function POST(request: Request) {
  const sdk = stripeSdk();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sdk || !secret) return Response.json({ error: "Stripe isn't set up here." }, { status: 503 });

  const payload = await request.text();
  let event;
  try {
    event = await sdk.webhooks.constructEventAsync(payload, request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return Response.json({ error: "That isn't signed by Stripe." }, { status: 400 });
  }

  const done = await applyPassEvent(createAdminClient(), passStripe(sdk)!, event, new Date());
  return Response.json({ received: true, done });
}
