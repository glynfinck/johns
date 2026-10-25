import { DisplayName, humanError } from '@app/core';

import { supabase } from './supabase';

/** Rename yourself: the one profile column a housemate may write. */
export async function setMyName(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', userId);
  if (error) throw error;
}

/** Rename yourself from House: 1 to 60 characters, and a refusal in words. */
export async function renameMe(userId: string, name: string): Promise<void> {
  const parsed = DisplayName.safeParse(name);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  await setMyName(userId, parsed.data).catch((error: { message?: string; code?: string }) => {
    throw new Error(humanError(error));
  });
}
