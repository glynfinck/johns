import "server-only";

import type { HouseContext } from "./house";

export const REACTIONS = ["nice", "fire", "sparkle", "eyes"] as const;
export type ReactionKind = (typeof REACTIONS)[number];

export interface WallEvent {
  id: string;
  kind: string;
  userId: string | null;
  assignmentId: string | null;
  data: Record<string, unknown>;
  createdAt: Date;
  photoUrl: string | null;
  reactions: Record<ReactionKind, { count: number; mine: boolean }>;
}

/** The Wall: what the house did, latest first, with photos and reactions. */
export async function getWall(ctx: HouseContext, limit = 60): Promise<WallEvent[]> {
  const { supabase, house } = ctx;
  const { data: events } = await supabase
    .from("events")
    .select("id, kind, user_id, assignment_id, data, created_at, assignments(photo_path), reactions(user_id, kind)")
    .eq("house_id", house.id)
    .neq("kind", "week_dealt")
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = events ?? [];

  // Photos are private: sign each one for an hour, in one round trip.
  const paths = [
    ...new Set(
      rows
        .filter((e) => (e.kind === "done" || e.kind === "late") && e.assignments?.photo_path)
        .map((e) => e.assignments!.photo_path!),
    ),
  ];
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage.from("proofs").createSignedUrls(paths, 3600);
    for (const s of data ?? []) if (s.signedUrl && s.path) signed.set(s.path, s.signedUrl);
  }

  return rows.map((e) => {
    const reactions = Object.fromEntries(
      REACTIONS.map((k) => {
        const of = (e.reactions ?? []).filter((r) => r.kind === k);
        return [k, { count: of.length, mine: of.some((r) => r.user_id === ctx.userId) }];
      }),
    ) as WallEvent["reactions"];
    const photo = e.assignments?.photo_path ?? null;
    return {
      id: e.id,
      kind: e.kind,
      userId: e.user_id,
      assignmentId: e.assignment_id,
      data: (e.data ?? {}) as Record<string, unknown>,
      createdAt: new Date(e.created_at),
      photoUrl: photo && (e.kind === "done" || e.kind === "late") ? (signed.get(photo) ?? null) : null,
      reactions,
    };
  });
}
