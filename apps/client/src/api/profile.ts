import { supabase } from './supabase';

/** Rename yourself: the one profile column a housemate may write. */
export async function setMyName(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', userId);
  if (error) throw error;
}
