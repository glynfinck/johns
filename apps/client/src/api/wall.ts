import { humanError, photoPaths, wallEvents, type ReactionKind, type WallEvent } from '@app/core';

import { supabase } from './supabase';

// The Wall: what the house did, read through your own session (RLS decides),
// and your reactions, written as your own rows.

/** How long a photo's signed link lasts: long enough to look, short enough not to share. */
const PHOTO_SECONDS = 3600;

export interface Wall {
  events: WallEvent[];
  /** Signed links for the receipts on show, by their path in `proofs`. */
  photos: Record<string, string>;
  /** Where the next page of older events starts, when this one came back full; null at the start of the house. */
  older: WallCursor | null;
}

/**
 * The last event on a page, as the database has it: older events come
 * strictly before it. The id breaks a tie between events written in the
 * same instant (a week closing writes several).
 */
export interface WallCursor {
  createdAt: string;
  id: string;
}

/**
 * The latest of the house's events, with their photos signed for an hour.
 * With `before`, the page of events older than that cursor instead.
 */
export async function loadWall(houseId: string, userId: string, limit = 60, before?: WallCursor): Promise<Wall> {
  const { events, older } = await readEvents(houseId, userId, limit, before);
  const paths = photoPaths(events);
  const photos: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from('proofs').createSignedUrls(paths, PHOTO_SECONDS);
    for (const s of signed ?? []) if (s.signedUrl && s.path) photos[s.path] = s.signedUrl;
  }
  return { events, photos, older };
}

/** The latest few of the house's events, with no photos signed: House's Wall never shows them. */
export async function loadWallEvents(houseId: string, userId: string, limit: number): Promise<Wall> {
  return { ...(await readEvents(houseId, userId, limit)), photos: {} };
}

/** One page of events, newest first, and where the next one starts. */
async function readEvents(
  houseId: string,
  userId: string,
  limit: number,
  before?: WallCursor,
): Promise<Pick<Wall, 'events' | 'older'>> {
  let query = supabase
    .from('events')
    .select('id, kind, user_id, assignment_id, data, created_at, assignments(photo_path), reactions(user_id, kind)')
    .eq('house_id', houseId)
    .neq('kind', 'week_dealt');
  if (before) {
    // Quoted: a timestamp's dots and colons would otherwise read as PostgREST's own.
    const at = `"${before.createdAt}"`;
    query = query.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${before.id})`);
  }
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  const last = rows[rows.length - 1];
  return {
    events: wallEvents(rows, userId),
    older: last && rows.length === limit ? { createdAt: last.created_at, id: last.id } : null,
  };
}

/** React to an event, or take your reaction back. */
export async function setReaction(eventId: string, userId: string, kind: ReactionKind, on: boolean): Promise<void> {
  const { error } = on
    ? await supabase.from('reactions').insert({ event_id: eventId, kind })
    : await supabase.from('reactions').delete().eq('event_id', eventId).eq('user_id', userId).eq('kind', kind);
  // A second tap that raced the first is already what was asked for.
  if (error && !error.message.includes('duplicate')) throw new Error(humanError(error));
}
