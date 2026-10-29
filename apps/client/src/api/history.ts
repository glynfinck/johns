import { historyItems, humanError, type ActionKind, type HistoryItem } from '@app/core';

import { supabase } from './supabase';

// History and Undo. house_history says, for each move, who may undo it now;
// undo_action and undo_latest check that again and put it back. The rules
// live in the migration (20261101090000_undo_history.sql).

/** How many moves a page of History reads. */
export const HISTORY_PAGE = 60;

/** A page of History, newest first: before `before`, when given. */
export async function loadHistory(houseId: string, before?: Date): Promise<HistoryItem[]> {
  const { data, error } = await supabase.rpc('house_history', {
    p_house: houseId,
    p_before: before?.toISOString(),
    p_limit: HISTORY_PAGE,
  });
  if (error) throw new Error(humanError(error));
  return historyItems(data ?? []);
}

/** Undo one move from History. */
export async function undoAction(actionId: string): Promise<void> {
  const { error } = await supabase.rpc('undo_action', { p_action: actionId });
  if (error) throw new Error(humanError(error));
}

/**
 * A toast's Undo: take back your latest move of this kind about this (a
 * John, a dispute, a housemate; with nothing, your latest of the kind),
 * whatever its id.
 */
export async function undoLatest(kind: ActionKind, about?: string): Promise<void> {
  const { error } = await supabase.rpc('undo_latest', { p_kind: kind, p_about: about });
  if (error) throw new Error(humanError(error));
}
