import { humanError, RollCallRequest, RollCallResponse } from '@app/core';

import { apiPost } from './http';
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

/**
 * Tick a John with who did it (crew.ts), through apps/api, which tells the
 * people it names. Everyone in `crew` shares the points; holders left off
 * have a miss once it stands.
 */
export async function rollCall(assignmentId: string, crew: readonly string[], photoPath?: string): Promise<number> {
  const { people } = await apiPost(
    '/api/roll-call',
    RollCallRequest.parse({ assignmentId, crew, ...(photoPath ? { photoPath } : {}) }),
    RollCallResponse,
  );
  return people;
}

/** Take a tick back while it's still being checked. */
export function undoDone(assignmentId: string): Promise<void> {
  return call(supabase.rpc('undo_done', { p_assignment: assignmentId }));
}

/**
 * Cover a housemate's overdue John: you did it instead. It counts as their
 * miss, and its points and their missed forfeit come to you once it stands.
 */
export function coverJohn(assignmentId: string, photoPath?: string): Promise<void> {
  return call(supabase.rpc('cover_john', { p_assignment: assignmentId, p_photo_path: photoPath }));
}

/** Take a cover back while it's still being checked. */
export function undoCover(assignmentId: string): Promise<void> {
  return call(supabase.rpc('undo_cover', { p_assignment: assignmentId }));
}

/** Spend an immunity token: the John is excused, with no forfeit. */
export function spendImmunity(assignmentId: string): Promise<void> {
  return call(supabase.rpc('use_immunity', { p_assignment: assignmentId }));
}

/** Spend a swap token: one of your open Johns for a housemate's, this week. */
export function spendSwap(mine: string, theirs: string): Promise<void> {
  return call(supabase.rpc('use_swap', { p_mine: mine, p_theirs: theirs }));
}
