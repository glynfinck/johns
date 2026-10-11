import "server-only";

import { tickHouse } from "@/lib/engine/tick";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Catch a house up before showing it.
 *
 * pg_cron runs the tick every ten minutes in production, but a page should
 * never show last week's rota because the alarm has not gone off yet, and
 * local development has no alarm at all. So a page load runs the same tick
 * for the one house it is about, no more than once a minute, without
 * sending any pushes (those are the cron tick's job).
 *
 * Only call this for a house the viewer has already been shown to belong
 * to through their own session: the tick runs as the service role.
 */
export async function ensureFresh(houseId: string, tickedAt: string | null, now: Date) {
  if (tickedAt && now.getTime() - new Date(tickedAt).getTime() < 60_000) return;
  try {
    await tickHouse(createAdminClient(), houseId, now);
  } catch (e) {
    // A failed catch-up must never take the page down with it.
    console.error("ensureFresh", houseId, e);
  }
}
