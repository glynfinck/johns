import "server-only";

import { addDaysTo, localDate, type AwayPeriod } from "@app/core";

import type { HouseContext } from "./house";

export interface AwayView {
  /** Today in the house's zone, `yyyy-MM-dd`. */
  today: string;
  /** Everyone's time away from the last week onwards, earliest first. */
  periods: AwayPeriod[];
}

/** Time away the house can see: what's on now, what's coming, and the last week of it. */
export async function getAway(ctx: HouseContext): Promise<AwayView> {
  const today = localDate(ctx.now, ctx.rules.timezone);
  const { data } = await ctx.supabase
    .from("away")
    .select("id, user_id, starts_on, ends_on, note")
    .eq("house_id", ctx.house.id)
    .gte("ends_on", addDaysTo(today, -7))
    .order("starts_on");
  return {
    today,
    periods: (data ?? []).map((a) => ({
      id: a.id,
      userId: a.user_id,
      startsOn: a.starts_on,
      endsOn: a.ends_on,
      note: a.note,
    })),
  };
}
