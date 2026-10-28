import "server-only";

import webpush from "web-push";

import type { Notify } from "@/lib/engine/tick";
import type { AdminClient } from "@/lib/supabase/admin";

/**
 * Web Push delivery for the engine's `Notify`.
 *
 * Returns undefined when the VAPID keys are not configured, which the engine
 * reads as "send nothing": a deployment without keys simply has no
 * reminders, rather than failing its tick.
 */
export function pushNotifier(db: AdminClient): Notify | undefined {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@jonz.app";
  if (!publicKey || !privateKey) return undefined;
  webpush.setVapidDetails(subject, publicKey, privateKey);

  return async (userIds, message) => {
    if (userIds.length === 0) return;
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", userIds);
    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(message),
          { TTL: 60 * 60 * 6 },
        );
      } catch (e) {
        // 404 and 410 mean the browser has thrown the subscription away.
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
  };
}
