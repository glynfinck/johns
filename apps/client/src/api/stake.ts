import { buildStake, humanError, monthOf, type HistoryRow, type HouseRules, type StakeView } from '@app/core';

import { supabase } from './supabase';

// The Stake, read through your own session (RLS decides) and built by core,
// as the web builds it. The app never moves money: it only records that a
// payment arrived, and only the person paid can.

/**
 * The Stake as House and Stake history read it: core's StakeView, plus the
 * whole ledger (each forfeit with its John's name and how it ended) and the
 * months already closed, for saying which month a debt is from.
 */
export interface StakeRead extends StakeView {
  /** Newest first. */
  ledger: HistoryRow[];
  closedMonths: string[];
}

/** The house's ledger and closed months, as the Stake shows them now. */
export async function loadStake(
  houseId: string,
  rules: HouseRules,
  memberIds: readonly string[],
  now: Date,
): Promise<StakeRead> {
  const [ledger, closes] = await Promise.all([
    readLedger(houseId),
    supabase.from('month_closes').select('month').eq('house_id', houseId),
  ]);
  if (closes.error) throw closes.error;
  const rows: HistoryRow[] = ledger.map(({ assignments, ...row }) => ({ ...row, john: assignments ?? null }));
  const closedMonths = (closes.data ?? []).map((c) => c.month);
  return {
    ...buildStake({
      ledger: rows,
      closedMonths,
      memberIds,
      stakeMinor: rules.stakeMinor,
      month: monthOf(now, rules.timezone),
    }),
    ledger: rows,
    closedMonths,
  };
}

/**
 * PostgREST hands back at most this many rows a read (`max_rows`, 1000 on
 * Supabase and in config.toml), and says nothing when it stops short.
 */
const PAGE = 1000;

/**
 * The house's whole ledger, newest first, a page at a time: every balance is
 * a sum of all of it, so a long-lived house can't lose its oldest rows.
 */
async function readLedger(houseId: string) {
  const page = (from: number) =>
    supabase
      .from('ledger')
      .select('id, user_id, kind, amount_minor, month, counterparty, created_at, assignments(name, outcome, due_at)')
      .eq('house_id', houseId)
      .order('created_at', { ascending: false })
      // Rows written together share a time; the id keeps the pages from overlapping.
      .order('id', { ascending: false })
      .range(from, from + PAGE - 1);
  const rows: NonNullable<Awaited<ReturnType<typeof page>>['data']> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return rows;
  }
}

/** Say the money arrived: only the person paid can (confirm_payment checks). */
export async function confirmPayment(houseId: string, fromUserId: string, amountMinor: number): Promise<void> {
  const { error } = await supabase.rpc('confirm_payment', { p_house: houseId, p_from: fromUserId, p_amount: amountMinor });
  if (error) throw new Error(humanError(error));
}
