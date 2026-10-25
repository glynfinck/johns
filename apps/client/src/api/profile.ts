import { supabase } from './supabase';

/** Your own display name, as housemates see it; null before the profile exists. */
export async function getMyName(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data?.display_name ?? null;
}

/** Rename yourself: the one profile column a housemate may write. */
export async function setMyName(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', userId);
  if (error) throw error;
}
