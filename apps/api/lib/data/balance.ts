import "server-only";

import { balanceRows, weekWindow, type BalanceRow } from "@app/core";

import { loadBalances } from "@/lib/engine/tick";

import type { HouseContext } from "./house";

export type { BalanceRow } from "@app/core";

/** Everyone's balance against their share, the same numbers this week's deal used. */
export async function getBalances(ctx: HouseContext): Promise<BalanceRow[]> {
  const week = weekWindow(ctx.now, ctx.rules.timezone, ctx.rules.weekStarts);
  const ids = ctx.members.map((m) => m.userId);
  const { balances, usualShare } = await loadBalances(ctx.supabase, ctx.house.id, week.startsOn, ids);
  return balanceRows(balances, usualShare, ids);
}
