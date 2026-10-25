import "server-only";

import { buildStake, monthOf, type StakeView } from "@app/core";

import type { HouseContext } from "./house";

export type { StakeView } from "@app/core";

/** The Stake, from the house's ledger and the months already closed (built in core). */
export async function getStake(ctx: HouseContext): Promise<StakeView> {
  const { supabase, house, rules, now } = ctx;
  const [{ data: ledger }, { data: closes }] = await Promise.all([
    supabase
      .from("ledger")
      .select("id, user_id, kind, amount_minor, month, counterparty, created_at")
      .eq("house_id", house.id)
      .order("created_at", { ascending: false }),
    supabase.from("month_closes").select("month").eq("house_id", house.id),
  ]);
  return buildStake({
    ledger: ledger ?? [],
    closedMonths: (closes ?? []).map((c) => c.month),
    memberIds: ctx.members.map((m) => m.userId),
    stakeMinor: rules.stakeMinor,
    month: monthOf(now, rules.timezone),
  });
}
