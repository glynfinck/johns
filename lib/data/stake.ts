import "server-only";

import { balances, monthOf, settleMonth, settleUp, type Transfer } from "@app/core";

import type { HouseContext } from "./house";

export interface StakeView {
  month: string;
  stakeMinor: number;
  /** This month so far, as if it closed now. */
  projection: {
    userId: string;
    forfeitedRaw: number;
    forfeited: number;
    received: number;
    net: number;
  }[];
  /** Everything owed from closed months, after payments. */
  outstanding: Map<string, number>;
  transfers: Transfer[];
  history: {
    id: number;
    userId: string;
    kind: string;
    amount: number;
    month: string;
    counterparty: string | null;
    createdAt: string;
  }[];
}

export async function getStake(ctx: HouseContext): Promise<StakeView> {
  const { supabase, house, rules, now } = ctx;
  const month = monthOf(now, rules.timezone);
  const { data: rows } = await supabase
    .from("ledger")
    .select("id, user_id, kind, amount_minor, month, counterparty, created_at")
    .eq("house_id", house.id)
    .order("created_at", { ascending: false });
  const ledger = rows ?? [];

  const memberIds = ctx.members.map((m) => m.userId);
  const thisMonthForfeits = ledger
    .filter((r) => r.month === month && r.kind === "forfeit")
    .map((r) => ({ userId: r.user_id, amount: -r.amount_minor }));
  const live = settleMonth(memberIds, rules.stakeMinor, thisMonthForfeits);
  const raw = new Map<string, number>();
  for (const f of thisMonthForfeits) raw.set(f.userId, (raw.get(f.userId) ?? 0) + f.amount);

  const projection = memberIds.map((id) => ({
    userId: id,
    forfeitedRaw: raw.get(id) ?? 0,
    forfeited: live.forfeited[id] ?? 0,
    received: live.received[id] ?? 0,
    net: (live.received[id] ?? 0) - (live.forfeited[id] ?? 0),
  }));

  // Only closed months (and payments against them) are owed for real: this
  // month's forfeits are not shared out until it ends.
  const { data: closes } = await supabase.from("month_closes").select("month").eq("house_id", house.id);
  const closed = new Set((closes ?? []).map((c) => c.month));
  const settled = ledger.filter((r) => r.kind === "payment" || closed.has(r.month));
  const outstanding = balances(settled.map((r) => ({ userId: r.user_id, amount: r.amount_minor })));

  return {
    month,
    stakeMinor: rules.stakeMinor,
    projection,
    outstanding,
    transfers: settleUp(outstanding),
    history: ledger.slice(0, 50).map((r) => ({
      id: r.id,
      userId: r.user_id,
      kind: r.kind,
      amount: r.amount_minor,
      month: r.month,
      counterparty: r.counterparty,
      createdAt: r.created_at,
    })),
  };
}
