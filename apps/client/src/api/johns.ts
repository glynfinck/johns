import { humanError } from '@app/core';

import { supabase } from './supabase';

// Your moves on a John. Each is one SQL function, which decides (the rules
// live in supabase/migrations); these only turn a refusal into a sentence.

async function call(result: PromiseLike<{ error: { message?: string; code?: string } | null }>): Promise<void> {
  const { error } = await result;
  if (error) throw new Error(humanError(error));
}

/** Tick a John, with the storage path of a photo receipt when there is one. */
export function markDone(assignmentId: string, photoPath?: string): Promise<void> {
  return call(supabase.rpc('mark_done', { p_assignment: assignmentId, p_photo_path: photoPath }));
}

/** Take a tick back while it's still being checked. */
export function undoDone(assignmentId: string): Promise<void> {
  return call(supabase.rpc('undo_done', { p_assignment: assignmentId }));
}

/** Spend an immunity token: the John is excused, with no forfeit. */
export function spendImmunity(assignmentId: string): Promise<void> {
  return call(supabase.rpc('use_immunity', { p_assignment: assignmentId }));
}

/** Spend a swap token: one of your open Johns for a housemate's, this week. */
export function spendSwap(mine: string, theirs: string): Promise<void> {
  return call(supabase.rpc('use_swap', { p_mine: mine, p_theirs: theirs }));
}
