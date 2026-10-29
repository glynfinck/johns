import "server-only";

import {
  CHAT_TURNS_PER_DAY,
  draftForModel,
  firstName,
  offlineTurn,
  tidyAsk,
  tidyDraft,
  type ChatMessage,
  type ChatResponse,
  type HouseDraft,
  type IsoDow,
} from "@app/core";

import { askClaude, canDraft, type DraftAnswer, type DraftContext } from "@/lib/ai/house-draft";
import { createAdminClient } from "@/lib/supabase/admin";

import type { Caller, Refusal } from "./disputes";

/** The most Jonz says in one turn, so a runaway reply can't fill the screen. */
const REPLY_MAX = 600;

/**
 * Describe your house: one turn of the setup chat. An admin's message (and
 * the chat before it, and the draft as it stands) in; Jonz's reply, a
 * question to tap an answer to, and the new draft out. Only an admin of the
 * house may ask (the list is theirs to change), and a house gets
 * CHAT_TURNS_PER_DAY turns from Claude a day. When Claude isn't set up or
 * doesn't answer, offlineTurn answers (a starter list that fits, or the
 * draft left as it is), so setup never stops here. Nothing is written to the
 * John list: the admin keeps what they want of the draft through the list's
 * own grants.
 *
 * `ask` is Claude, unless a test stands in for it.
 */
export async function chatTurn(
  caller: Caller,
  houseId: string,
  messages: readonly ChatMessage[],
  current: HouseDraft | null,
  now: Date,
  ask: (ctx: DraftContext) => Promise<DraftAnswer> = askClaude,
): Promise<{ refusal: Refusal } | ChatResponse> {
  const { data: me } = await caller.db
    .from("members")
    .select("role")
    .eq("house_id", houseId)
    .eq("user_id", caller.userId)
    .maybeSingle();
  if (!me) return { refusal: { code: "42501", message: "not_in_house" } };
  if (me.role !== "admin") return { refusal: { code: "42501", message: "admins_only" } };

  if (!canDraft() && ask === askClaude) return offlineTurn(messages, current);

  const admin = createAdminClient();
  const since = new Date(now.getTime() - 24 * 3600_000).toISOString();
  const { count } = await admin
    .from("house_drafts")
    .select("id", { count: "exact", head: true })
    .eq("house_id", houseId)
    .gte("created_at", since);
  if ((count ?? 0) >= CHAT_TURNS_PER_DAY) return { refusal: { code: "P0001", message: "draft_limit" } };

  const [{ data: house }, { data: members }] = await Promise.all([
    caller.db.from("houses").select("week_starts").eq("id", houseId).single(),
    caller.db.from("members").select("user_id, joined_at, profiles(display_name)").eq("house_id", houseId).order("joined_at"),
  ]);
  const people = (members ?? []).map((m) => ({ userId: m.user_id, name: m.profiles?.display_name ?? "" })).filter((p) => p.name);
  // The person writing first: "me" in what they say is them.
  people.sort((a, b) => Number(b.userId === caller.userId) - Number(a.userId === caller.userId));

  let answer: DraftAnswer;
  try {
    answer = await ask({
      people: people.map((p) => firstName(p.name)),
      weekStarts: (house?.week_starts ?? 1) as IsoDow,
      messages,
      draft: current ? draftForModel(current, people, caller.userId) : null,
    });
  } catch (e) {
    console.error("draft_failed", e instanceof Error ? e.message : e);
    await admin.from("house_drafts").insert({ house_id: houseId, user_id: caller.userId, outcome: "failed" });
    return offlineTurn(messages, current);
  }

  // A draft with nothing in it (the message wasn't about a house) leaves the draft as it was.
  const tidied = answer.raw.draft ? tidyDraft(answer.raw.draft, people, caller.userId) : null;
  const draft = tidied && tidied.johns.length > 0 ? tidied : null;
  await admin.from("house_drafts").insert({
    house_id: houseId,
    user_id: caller.userId,
    outcome: "ai",
    johns: draft?.johns.length ?? 0,
    input_tokens: answer.inputTokens,
    output_tokens: answer.outputTokens,
  });
  const reply = answer.raw.reply.replace(/\s+/g, " ").trim().slice(0, REPLY_MAX);
  // Nothing to say and nothing drafted before: a starter list does better than silence.
  if (!reply && !draft && !current) return offlineTurn(messages, current);
  return { reply, ask: tidyAsk(answer.raw.ask), draft, source: "ai" };
}
