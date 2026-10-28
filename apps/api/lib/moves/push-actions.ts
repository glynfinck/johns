import "server-only";

import { NOTIFY_COPY, type PushActionRequest, type PushActionResponse } from "@app/core";

import { tickHouse } from "@/lib/engine/tick";
import { readPushToken } from "@/lib/push-token";
import { createAdminClient } from "@/lib/supabase/admin";

import type { Refusal } from "./disputes";

// A button on a notification. There's no session: the token that came with
// the push says who and what, and push_action makes the move as them through
// the same function the app calls, so it's refused exactly where the app's
// would be (a John that needs a photo, a vote that has closed).

export type PushAnswer = { ok: PushActionResponse } | { expired: true } | { mismatch: true } | { refusal: Refusal };

export async function answerPush({ token, action }: PushActionRequest, now: Date): Promise<PushAnswer> {
  const grant = readPushToken(token, now);
  if (!grant) return { expired: true };
  const admin = createAdminClient();

  if ("assignmentId" in grant) {
    if (action !== "done") return { mismatch: true };
    const { error } = await admin.rpc("push_action", {
      p_user: grant.userId,
      p_assignment: grant.assignmentId,
      p_dispute: null as unknown as string,
      p_uphold: null as unknown as boolean,
    });
    const { data: a } = await admin.from("assignments").select("name").eq("id", grant.assignmentId).maybeSingle();
    const name = a?.name ?? "That John";
    if (error?.message === "already_done") return { ok: { ok: true, title: NOTIFY_COPY.alreadyTicked(name), body: "" } };
    if (error) return { refusal: error };
    return { ok: { ok: true, title: NOTIFY_COPY.ticked(name), body: NOTIFY_COPY.tickedBody } };
  }

  if (action === "done") return { mismatch: true };
  const { error } = await admin.rpc("push_action", {
    p_user: grant.userId,
    p_assignment: null as unknown as string,
    p_dispute: grant.disputeId,
    p_uphold: action === "struck",
  });
  if (error) return { refusal: error };
  // Decide it now if this vote made a majority, as a vote in the app does.
  const { data: d } = await admin
    .from("disputes")
    .select("house_id, assignments(name)")
    .eq("id", grant.disputeId)
    .single();
  if (d) await tickHouse(admin, d.house_id, now);
  return {
    ok: {
      ok: true,
      title: NOTIFY_COPY.voted(d?.assignments?.name ?? "that John"),
      body: action === "struck" ? NOTIFY_COPY.votedStruck : NOTIFY_COPY.votedHeld,
    },
  };
}
