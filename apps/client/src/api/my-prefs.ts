import { humanError, type MyPrefs } from '@app/core';

import { supabase } from './supabase';

// Your preferences in a house: days that suit you, your best time, and the
// Johns you'd rather do or not (members.suits_days, best_time, rather).
// save_prefs keeps only real days and this house's own Johns.

/** Save them all at once. */
export async function saveMyPrefs(houseId: string, prefs: MyPrefs): Promise<void> {
  const { error } = await supabase.rpc('save_prefs', {
    p_house: houseId,
    p_days: prefs.days,
    p_best_time: prefs.bestTime as string,
    p_rather: prefs.rather,
  });
  if (error) throw new Error(humanError(error));
}
