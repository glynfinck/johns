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
}

/** The latest of the house's events, with their photos signed for an hour. */
export async function loadWall(houseId: string, userId: string, limit = 60): Promise<Wall> {
  const { data, error } = await supabase
    .from('events')
    .select('id, kind, user_id, assignment_id, data, created_at, assignments(photo_path), reactions(user_id, kind)')
    .eq('house_id', houseId)
    .neq('kind', 'week_dealt')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const events = wallEvents(data ?? [], userId);

  const paths = photoPaths(events);
  const photos: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from('proofs').createSignedUrls(paths, PHOTO_SECONDS);
    for (const s of signed ?? []) if (s.signedUrl && s.path) photos[s.path] = s.signedUrl;
  }
  return { events, photos };
}

/** React to an event, or take your reaction back. */
export async function setReaction(eventId: string, userId: string, kind: ReactionKind, on: boolean): Promise<void> {
  const { error } = on
    ? await supabase.from('reactions').insert({ event_id: eventId, kind })
    : await supabase.from('reactions').delete().eq('event_id', eventId).eq('user_id', userId).eq('kind', kind);
  // A second tap that raced the first is already what was asked for.
  if (error && !error.message.includes('duplicate')) throw new Error(humanError(error));
}
