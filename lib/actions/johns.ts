"use server";

import { refresh } from "next/cache";

import { tickHouse } from "@/lib/engine/tick";
import { humanError } from "@/lib/errors";
import { pushNotifier } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type Outcome = { error?: string } | void;

/**
 * The housemate's moves on a John. Each one is a single call to the SQL
 * function that owns the rule (supabase/migrations): these wrappers only
 * translate refusals into sentences and refresh the screen.
 */

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
  const text = reason.trim();
  if (!text) return { error: "Say what's wrong with it." };
  if (text.length > 280) return { error: "Keep it under 280 characters." };
  const { supabase, error } = await call((db) =>
    db.rpc("raise_dispute", { p_assignment: assignmentId, p_reason: text }),
  );
  if (error) return { error: humanError(error) };

  // Tell the house there is something to vote on. Who to tell is read
  // through the caller's own session, so this can only reach their house.
  const { data: a } = await supabase.from("assignments").select("house_id, user_id, name").eq("id", assignmentId).single();
  if (a) {
    const admin = createAdminClient();
    const notify = pushNotifier(admin);
    const { data: members } = await supabase.from("members").select("user_id").eq("house_id", a.house_id);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (notify && members) {
      const voters = members.map((m) => m.user_id).filter((id) => id !== a.user_id && id !== user?.id);
      await notify([a.user_id], { title: `Your ${a.name} tick is disputed`, body: text, url: "/week" });
      await notify(voters, { title: `Vote: was ${a.name} really done?`, body: text, url: "/week" });
    }
    // In a house of two the raiser's own vote is already the majority.
    await tickHouse(admin, a.house_id, new Date());
  }
  refresh();
}

export async function castVote(disputeId: string, uphold: boolean): Promise<Outcome> {
  const { supabase, error } = await call((db) => db.rpc("cast_vote", { p_dispute: disputeId, p_uphold: uphold }));
  if (error) return { error: humanError(error) };
  // Decide it now if this vote made a majority, rather than on the next tick.
  // The house is the one the caller just voted in, read through RLS.
  const { data: d } = await supabase.from("disputes").select("house_id").eq("id", disputeId).single();
  if (d) await tickHouse(createAdminClient(), d.house_id, new Date());
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
