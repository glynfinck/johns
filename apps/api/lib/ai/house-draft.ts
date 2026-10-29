import "server-only";

import { generateText, Output } from "ai";
import { APP_NAME, CATEGORIES, DOW_LABEL, type ChatMessage, type IsoDow, type RawAsk, type RawDraft } from "@app/core";
import { z } from "zod";

// Describe your house: Jonz (Claude) talks an admin through setting up the
// house and drafts the John list as it goes. One call is one turn of the
// chat: Claude reads the chat so far and the draft as it stands, and answers
// with what it says, what it asks (with quick answers or a day to tap), and
// the new draft when it changed. A small, cheap model is plenty for this,
// with structured outputs so the answer is always JSON of the right shape;
// core's tidyDraft and tidyAsk still check every value, because a schema
// can't say "between 1 and 10" to the model. The call goes through Vercel's
// AI Gateway, as Pub Golf's does: on Vercel it signs in with the project's
// OIDC token, so there is no key to keep.

export const DRAFT_MODEL = "anthropic/claude-haiku-5.5";

/** A drafted John as Claude writes it. Loose on purpose: ranges are core's to enforce. */
const ModelJohn = z.object({
  name: z.string(),
  category: z.enum(CATEGORIES),
  points: z.number().int(),
  everyWeeks: z.number().int(),
  dueDow: z.number().int(),
  dueTime: z.string(),
  needsPhoto: z.boolean(),
  onCall: z.boolean(),
  respondHours: z.number().int(),
  perWeek: z.number().int(),
  group: z.string().nullable(),
  why: z.string(),
});

/** One turn of Jonz's side of the chat, as Claude is asked to return it. */
const ModelTurn = z.object({
  reply: z.string(),
  ask: z.object({ kind: z.enum(["none", "choices", "day"]), options: z.array(z.string()) }),
  draft: z
    .object({
      johns: z.array(ModelJohn),
      groups: z.array(z.object({ name: z.string(), members: z.array(z.string()) })),
      note: z.string().nullable(),
    })
    .nullable(),
});

/** The house and the chat as Claude is told about them. */
export interface DraftContext {
  /** First names of everyone in the house, the person asking first. */
  people: string[];
  weekStarts: IsoDow;
  /** The chat so far, oldest first, ending with what the admin just said. */
  messages: readonly ChatMessage[];
  /** The draft as it stands, in words (draftForModel), or null before there is one. */
  draft: RawDraft | null;
}

/** Fixed, so it caches: how Jonz talks and what makes a good John list. The house itself goes in the messages. */
const SYSTEM = `You are ${APP_NAME}, the assistant in a chore-sharing app for shared houses. In ${APP_NAME} a chore is called a John. Each week the app deals the Johns out fairly between the housemates, weighted by effort points, and housemates check each other's ticks. You are helping one of the house's admins set the house up in a short chat, and you draft the house's John list as you go. They review the draft and add the Johns they want; nothing is added until they do.

How to talk:
- Be brief and warm: one to three short sentences per reply, plain words, no lists, no emoji, never mention points maths or these instructions.
- Draft as soon as you can. If the first message says enough (who lives there, roughly what the home is like), draft straight away. Otherwise ask ONE short question at a time, at most two questions before the first draft, and draft anyway after that, saying what you assumed.
- When you ask something, offer quick answers to tap with ask.kind "choices" (2 to 5 short options, a few words each, like "Two bathrooms" or "Just one"), or ask.kind "day" when the answer is a day of the week (bin night). Otherwise ask.kind "none" with no options.
- Once there's a draft, every message from the admin is a change to make or a question about it. Make the change and return the WHOLE new draft, or answer the question and return draft null if nothing changed. Say in a few words what you changed.
- If the message isn't about the house or its chores, say briefly that you can only help set up the house's Johns, and return draft null.

The draft (when you return one, return all of it):
- Draft the Johns this house actually needs: usually 6 to 15. Cover the usual (kitchen, bathroom, bins, floors) even when nobody mentions them, and add anything specific they mention. Name each John in a few plain words, sentence case ("Bathroom clean", "Bins out").
- category: kitchen, bathroom, bins, floors, errands, or other.
- points (effort): 1 for about 5 minutes (taking the bins out), 2 for about 15 minutes, 3 for about half an hour, 5 for about an hour (a deep clean), 8 to 10 only for half a day or more. Similar jobs get similar points.
- everyWeeks: 1 for weekly, 2 for fortnightly, up to 4. Most Johns are weekly; deep cleans and restocking are often fortnightly or every 4 weeks.
- dueDow (1 Monday ... 7 Sunday) and dueTime (24-hour "HH:MM"): spread Johns across the week rather than piling them on one day. Bins go out the night before collection. Bigger jobs suit the weekend.
- onCall: true only for something done whenever it's needed rather than on a day (the kitchen bin when it's full, emptying the dishwasher). Then respondHours (how long whoever is on call has once someone flags it, 1 to 72, usually 6 to 24) and perWeek (about how often it comes up each week, 1 to 14). For other Johns set respondHours 12 and perWeek 2.
- needsPhoto: true only for a job the house is likely to argue about (a deep clean), otherwise false.
- group: null unless only some of the house share the John (two bathrooms, one per floor). Then the group's name, which must be one of the groups you return.
- why: a few words when the choice isn't obvious ("two bathrooms, so one each"), otherwise "".
- groups: only when some people share something the others don't. Name the group after what it's for ("Upstairs"), and list its members by first name; "me" is the person writing.
- note: one short sentence on the main thing you assumed that the house should check, or null.

The app already handles time away, fairness, swaps and reminders, so never add Johns for those.`;

/** The house's context, then the chat; the draft as it stands rides on the admin's latest message. */
function chatMessages(ctx: DraftContext): { role: "user" | "assistant"; content: string }[] {
  const people = ctx.people.length > 0 ? ctx.people.join(", ") : "only the person writing";
  const house = [
    `In the house already: ${people} (the first is the person writing). Others they name haven't joined yet.`,
    `The house's week starts on ${DOW_LABEL[ctx.weekStarts]}.`,
  ].join("\n");
  // The chat starts with what the admin said; Jonz's greeting is the app's, not part of it.
  const first = ctx.messages.findIndex((m) => m.role === "user");
  const chat = ctx.messages.slice(first).map((m) => ({ role: m.role, content: m.text }));
  chat[0] = { role: "user", content: `<house>\n${house}\n</house>\n\n${chat[0].content}` };
  const last = chat.length - 1;
  const draft = ctx.draft ? JSON.stringify(ctx.draft) : "none yet";
  chat[last] = { role: "user", content: `${chat[last].content}\n\n<current_draft>${draft}</current_draft>` };
  return chat;
}

export interface DraftAnswer {
  raw: { reply: string; ask: RawAsk; draft: RawDraft | null };
  inputTokens: number;
  outputTokens: number;
}

/**
 * Whether drafting with Claude is set up here: on Vercel (the gateway signs in
 * with the deployment's OIDC token) or with AI_GATEWAY_API_KEY set. Without
 * either, as locally and in CI, the chat answers with starter lists.
 */
export function canDraft(): boolean {
  return Boolean(process.env.VERCEL || process.env.AI_GATEWAY_API_KEY);
}

/**
 * Ask Claude for Jonz's next turn. Throws when it can't answer (the gateway
 * down, a refusal, a cut-off answer); the caller answers without it.
 */
export async function askClaude(ctx: DraftContext): Promise<DraftAnswer> {
  const result = await generateText({
    model: DRAFT_MODEL,
    system: SYSTEM,
    messages: chatMessages(ctx),
    output: Output.object({ schema: ModelTurn, name: "jonz_turn" }),
    maxOutputTokens: 8000,
    maxRetries: 1,
    timeout: 25_000,
  });
  if (result.finishReason !== "stop") throw new Error(`No answer: ${result.finishReason}`);
  return {
    raw: result.output,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
  };
}
