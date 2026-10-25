import { addDaysTo, AwayDraft, awayPeriod, humanError, localDate, type AwayPeriod } from '@app/core';

import { supabase } from './supabase';

// Time away, read through your own session and booked through set_away and
// cancel_away, which decide everything: no Johns due while you're gone, and
// the ones you already have pulled forward to before you go.

export interface AwayView {
  /** Today in the house's zone, `yyyy-MM-dd`. */
  today: string;
  /** Everyone's time away from the last week onwards, earliest first. */
  periods: AwayPeriod[];
}

/** The house's time away: what's on now, what's coming, and the last week of it, as the web reads it. */
export async function loadAway(houseId: string, zone: string, now: Date): Promise<AwayView> {
  const today = localDate(now, zone);
  const { data, error } = await supabase
    .from('away')
    .select('id, user_id, starts_on, ends_on, note')
    .eq('house_id', houseId)
    .gte('ends_on', addDaysTo(today, -7))
    .order('starts_on');
  if (error) throw error;
  return { today, periods: (data ?? []).map(awayPeriod) };
}

/** Book time away for yourself. Answers how many of your Johns it moved to before you go. */
export async function setAway(draft: AwayDraft): Promise<number> {
  const parsed = AwayDraft.safeParse(draft);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const { data, error } = await supabase.rpc('set_away', {
    p_starts: parsed.data.from,
    p_ends: parsed.data.to,
    p_note: parsed.data.note || undefined,
  });
  if (error) throw new Error(humanError(error));
  return data ?? 0;
}

/** Cancel time away, or come back early from it. The Johns it moved go back to when they were due. */
export async function cancelAway(awayId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_away', { p_away: awayId });
  if (error) throw new Error(humanError(error));
}
