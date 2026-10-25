import "server-only";

import { rulesOf, weekWindow } from "@app/core";

import { dealWeek, loadHouse } from "@/lib/engine/tick";
import { createAdminClient } from "@/lib/supabase/admin";

import type { Caller, Refusal } from "./disputes";

/**
 * Hand out this week's Johns. The first time, it starts the house off;
 * after that it re-deals the week, which deal_week only allows while nothing
 * in it has been ticked (someone new moved in, a John was added). deal_week
 * is the engine's, so who may ask is checked here, through the caller's own
 * session: only an admin of the house. The web's action and POST /api/deal
 * both call this.
 */
export async function dealThisWeek(caller: Caller, houseId: string, now: Date): Promise<Refusal | null> {
  const { data: me } = await caller.db
    .from("members")
    .select("role")
    .eq("house_id", houseId)
    .eq("user_id", caller.userId)
    .maybeSingle();
  if (!me) return { code: "42501", message: "not_in_house" };
  if (me.role !== "admin") return { code: "42501", message: "admins_only" };

  const admin = createAdminClient();
  const { house, members } = await loadHouse(admin, houseId);
  const rules = rulesOf(house);
  const week = weekWindow(now, rules.timezone, rules.weekStarts);
  try {
    const { weekId } = await dealWeek(admin, house, members, week, now, true);
    if (!weekId) return { code: "P0001", message: "no_johns" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // deal_week's own refusal: the week has a tick in it.
    return { code: message.includes("week_started") ? "P0001" : undefined, message };
  }
  return null;
}
