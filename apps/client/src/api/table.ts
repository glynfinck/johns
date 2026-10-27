import {
  BALANCE_WEEKS,
  balanceRows,
  monthOf,
  monthStandings,
  monthWindow,
  recentBalances,
  weekWindow,
  type BalanceRow,
  type HouseRules,
  type TableRow,
} from '@app/core';

import { supabase } from './supabase';

// The Table beyond this week: the month's standings and everyone's fair
// share, read through your own session (RLS decides) and summed by core, as
// the web and the deal sum them.

export interface TableSnapshot {
  /** `yyyy-MM`, the house's month now. */
  month: string;
  monthTable: TableRow[];
  /** Furthest behind first. */
  balances: BalanceRow[];
}

export async function loadTable(
  houseId: string,
  rules: HouseRules,
  memberIds: readonly string[],
  now: Date,
): Promise<TableSnapshot> {
  const month = monthOf(now, rules.timezone);
  const window = monthWindow(month, rules.timezone);
  const thisWeek = weekWindow(now, rules.timezone, rules.weekStarts);

  const [monthRows, pastWeeks] = await Promise.all([
    supabase
      .from('assignments')
      .select('user_id, points, outcome, done_at, due_at, excused, covered_by, weeks(ends_at)')
      .eq('house_id', houseId)
      .gte('due_at', window.startsAt.toISOString())
      .lt('due_at', window.endsAt.toISOString()),
    supabase
      .from('weeks')
      .select('id')
      .eq('house_id', houseId)
      .lt('starts_on', thisWeek.startsOn)
      .order('starts_on', { ascending: false })
      .limit(BALANCE_WEEKS),
  ]);
  if (monthRows.error) throw monthRows.error;
  if (pastWeeks.error) throw pastWeeks.error;

  const weekIds = (pastWeeks.data ?? []).map((w) => w.id);
  const [shares, handed] = weekIds.length
    ? await Promise.all([
        supabase.from('week_shares').select('week_id, user_id, share').in('week_id', weekIds),
        supabase.from('assignments').select('week_id, user_id, points').in('week_id', weekIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (shares.error) throw shares.error;
  if (handed.error) throw handed.error;

  const { balances, usualShare } = recentBalances(
    { weekIds, shares: shares.data ?? [], handed: handed.data ?? [] },
    memberIds,
  );
  return {
    month,
    monthTable: monthStandings(monthRows.data ?? [], memberIds, rules.disputeHours, now),
    balances: balanceRows(balances, usualShare, memberIds),
  };
}
