import { buildStake, humanError, monthOf, type HouseRules, type StakeView } from '@app/core';

import { supabase } from './supabase';

// The Stake, read through your own session (RLS decides) and built by core,
// as the web builds it. The app never moves money: it only records that a
// payment arrived, and only the person paid can.

/** The house's ledger and closed months, as the Stake shows them now. */
export async function loadStake(
  houseId: string,
  rules: HouseRules,
  memberIds: readonly string[],
  now: Date,
): Promise<StakeView> {
  const [ledger, closes] = await Promise.all([
    supabase
      .from('ledger')
      .select('id, user_id, kind, amount_minor, month, counterparty, created_at')
      .eq('house_id', houseId)
      .order('created_at', { ascending: false }),
    supabase.from('month_closes').select('month').eq('house_id', houseId),
  ]);
  if (ledger.error) throw ledger.error;
  if (closes.error) throw closes.error;
  return buildStake({
    ledger: ledger.data ?? [],
    closedMonths: (closes.data ?? []).map((c) => c.month),
    memberIds,
    stakeMinor: rules.stakeMinor,
    month: monthOf(now, rules.timezone),
  });
}

/** Say the money arrived: only the person paid can (confirm_payment checks). */
export async function confirmPayment(houseId: string, fromUserId: string, amountMinor: number): Promise<void> {
  const { error } = await supabase.rpc('confirm_payment', { p_house: houseId, p_from: fromUserId, p_amount: amountMinor });
  if (error) throw new Error(humanError(error));
}
