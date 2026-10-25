"use server";

import { disputeProblem, humanError, RaiseDispute } from "@app/core";
import { refresh } from "next/cache";

import * as moves from "@/lib/moves/disputes";
import { createClient } from "@/lib/supabase/server";

export type Outcome = { error?: string } | void;

/**
 * The housemate's moves on a John. Each one is a single call to the SQL
 * function that owns the rule (supabase/migrations): these wrappers only
 * translate refusals into sentences and refresh the screen.
 */

/** The signed-in housemate, as the shared moves (lib/moves) take them. */
async function signedIn(): Promise<moves.Caller | null> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  return user ? { db, userId: user.id } : null;
}

async function call<T>(fn: (db: Awaited<ReturnType<typeof createClient>>) => PromiseLike<{ error: T | null }>) {
  const supabase = await createClient();
  const { error } = await fn(supabase);
  return { supabase, error: error as { message?: string; code?: string } | null };
}

export async function markDone(assignmentId: string, photoPath?: string | null): Promise<Outcome> {
  const { error } = await call((db) =>
    db.rpc("mark_done", { p_assignment: assignmentId, p_photo_path: photoPath ?? undefined }),
  );
  if (error) return { error: humanError(error) };
  refresh();
}

export async function undoDone(assignmentId: string): Promise<Outcome> {
  const { error } = await call((db) => db.rpc("undo_done", { p_assignment: assignmentId }));
  if (error) return { error: humanError(error) };
  refresh();
}

export async function raiseDispute(assignmentId: string, reason: string): Promise<Outcome> {
  const input = RaiseDispute.safeParse({ assignmentId, reason });
  if (!input.success) return { error: disputeProblem(input.error.issues) };
  const caller = await signedIn();
  if (!caller) return { error: humanError({ message: "sign_in_required" }) };
  const refusal = await moves.raiseDispute(caller, input.data.assignmentId, input.data.reason, new Date());
  if (refusal) return { error: humanError(refusal) };
  refresh();
}

export async function castVote(disputeId: string, uphold: boolean): Promise<Outcome> {
  const caller = await signedIn();
  if (!caller) return { error: humanError({ message: "sign_in_required" }) };
  const refusal = await moves.castVote(caller, disputeId, uphold, new Date());
  if (refusal) return { error: humanError(refusal) };
  refresh();
}

export async function spendImmunity(assignmentId: string): Promise<Outcome> {
  const { error } = await call((db) => db.rpc("use_immunity", { p_assignment: assignmentId }));
  if (error) return { error: humanError(error) };
  refresh();
}

export async function spendSwap(mine: string, theirs: string): Promise<Outcome> {
  const { error } = await call((db) => db.rpc("use_swap", { p_mine: mine, p_theirs: theirs }));
  if (error) return { error: humanError(error) };
  refresh();
}

export async function confirmPayment(houseId: string, fromUserId: string, amountMinor: number): Promise<Outcome> {
  const { error } = await call((db) =>
    db.rpc("confirm_payment", { p_house: houseId, p_from: fromUserId, p_amount: amountMinor }),
  );
  if (error) return { error: humanError(error) };
  refresh();
}

export async function toggleReaction(eventId: string, kind: string, on: boolean): Promise<Outcome> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: humanError({ message: "sign_in_required" }) };
  const { error } = on
    ? await supabase.from("reactions").insert({ event_id: eventId, kind })
    : await supabase.from("reactions").delete().eq("event_id", eventId).eq("user_id", user.id).eq("kind", kind);
  if (error && !error.message.includes("duplicate")) return { error: humanError(error) };
  refresh();
}

export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }): Promise<Outcome> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: humanError({ message: "sign_in_required" }) };
  // A browser that re-subscribes keeps its endpoint; replace rather than duplicate.
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: sub.p256dh,
    auth: sub.auth,
  });
  if (error) return { error: humanError(error) };
}

export async function removePushSubscription(endpoint: string): Promise<Outcome> {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
