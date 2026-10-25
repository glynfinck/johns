import "server-only";

import { catchUpWeeks, weekWindow } from "@app/core";

import { loadBalances } from "@/lib/engine/tick";

import type { HouseContext } from "./house";

export interface BalanceRow {
  userId: string;
  /** Handed minus share over recent weeks, going into this week. Below zero is behind. */
  balance: number;
  /** About how many weeks of catching up are left at the catch-up pace. */
  weeksToEven: number;
}

/** Everyone's balance against their share, the same numbers this week's deal used. */
export async function getBalances(ctx: HouseContext): Promise<BalanceRow[]> {
  const week = weekWindow(ctx.now, ctx.rules.timezone, ctx.rules.weekStarts);
  const ids = ctx.members.map((m) => m.userId);
  const { balances, usualShare } = await loadBalances(ctx.supabase, ctx.house.id, week.startsOn, ids);
  return ids
    .map((id) => {
      const balance = balances.get(id) ?? 0;
      return { userId: id, balance, weeksToEven: catchUpWeeks(balance, usualShare.get(id) ?? 0) };
    })
    .sort((a, b) => a.balance - b.balance);
}
