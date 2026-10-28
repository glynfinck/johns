import "server-only";

import {
  DRAFTS_PER_DAY,
  firstName,
  guessStarter,
  starterDraft,
  tidyDraft,
  type DraftResponse,
  type IsoDow,
} from "@app/core";

import { askClaude, canDraft, type DraftAnswer, type DraftContext } from "@/lib/ai/house-draft";
import { createAdminClient } from "@/lib/supabase/admin";

import type { Caller, Refusal } from "./disputes";

/**
 * Describe your house: draft a John list for an admin to review. Only an
 * admin of the house may ask (the list is theirs to change), and a house
 * gets DRAFTS_PER_DAY drafts from Claude a day. When Claude isn't set up or
 * doesn't answer, a starter list that fits the description stands in, so
 * setup never stops here. Nothing is written to the John list: the admin
 * keeps what they want of the draft through the list's own grants.
 *
 * `ask` is Claude, unless a test stands in for it.
 */
export async function draftHouse(
  caller: Caller,
  houseId: string,
  description: string,
  now: Date,
  ask: (ctx: DraftContext) => Promise<DraftAnswer> = askClaude,
): Promise<{ refusal: Refusal } | DraftResponse> {
  const { data: me } = await caller.db
    .from("members")
    .select("role")
    .eq("house_id", houseId)
    .eq("user_id", caller.userId)
    .maybeSingle();
  if (!me) return { refusal: { code: "42501", message: "not_in_house" } };
  if (me.role !== "admin") return { refusal: { code: "42501", message: "admins_only" } };

  const starter = (): DraftResponse => ({ draft: starterDraft(guessStarter(description)), source: "starter" });
  if (!canDraft() && ask === askClaude) return starter();

  const admin = createAdminClient();
  const since = new Date(now.getTime() - 24 * 3600_000).toISOString();
  const { count } = await admin
    .from("house_drafts")
    .select("id", { count: "exact", head: true })
    .eq("house_id", houseId)
    .gte("created_at", since);
  if ((count ?? 0) >= DRAFTS_PER_DAY) return { refusal: { code: "P0001", message: "draft_limit" } };

  const [{ data: house }, { data: members }] = await Promise.all([
    caller.db.from("houses").select("week_starts").eq("id", houseId).single(),
    caller.db.from("members").select("user_id, joined_at, profiles(display_name)").eq("house_id", houseId).order("joined_at"),
  ]);
  const people = (members ?? []).map((m) => ({ userId: m.user_id, name: m.profiles?.display_name ?? "" })).filter((p) => p.name);
  // The person writing first: "me" in the description is them.
  people.sort((a, b) => Number(b.userId === caller.userId) - Number(a.userId === caller.userId));

  let answer: DraftAnswer;
  try {
    answer = await ask({ description, people: people.map((p) => firstName(p.name)), weekStarts: (house?.week_starts ?? 1) as IsoDow });
  } catch (e) {
    console.error("draft_failed", e instanceof Error ? e.message : e);
    await admin.from("house_drafts").insert({ house_id: houseId, user_id: caller.userId, outcome: "failed" });
    return starter();
  }

  const draft = tidyDraft(answer.raw, people, caller.userId);
  await admin.from("house_drafts").insert({
    house_id: houseId,
    user_id: caller.userId,
    outcome: "ai",
    johns: draft.johns.length,
    input_tokens: answer.inputTokens,
    output_tokens: answer.outputTokens,
  });
  // Nothing worth reviewing came back (it wasn't about a house): a starter list does better.
  if (draft.johns.length === 0) return starter();
  return { draft, source: "ai" };
}
