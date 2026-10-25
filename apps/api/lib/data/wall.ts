import "server-only";

import { photoPaths, wallEvents, type WallEvent as CoreWallEvent } from "@app/core";

import type { HouseContext } from "./house";

export { REACTIONS, type ReactionKind } from "@app/core";

/** An event as the web shows it: core's, with its receipt signed to show. */
export interface WallEvent extends CoreWallEvent {
  photoUrl: string | null;
}

/** The Wall: what the house did, latest first, with photos and reactions. */
export async function getWall(ctx: HouseContext, limit = 60): Promise<WallEvent[]> {
  const { supabase, house } = ctx;
  const { data: rows } = await supabase
    .from("events")
    .select("id, kind, user_id, assignment_id, data, created_at, assignments(photo_path), reactions(user_id, kind)")
    .eq("house_id", house.id)
    .neq("kind", "week_dealt")
    .order("created_at", { ascending: false })
    .limit(limit);
  const events = wallEvents(rows ?? [], ctx.userId);

  // Photos are private: sign each one for an hour, in one round trip.
  const paths = photoPaths(events);
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage.from("proofs").createSignedUrls(paths, 3600);
    for (const s of data ?? []) if (s.signedUrl && s.path) signed.set(s.path, s.signedUrl);
  }

  return events.map((e) => ({ ...e, photoUrl: e.photoPath ? (signed.get(e.photoPath) ?? null) : null }));
}
