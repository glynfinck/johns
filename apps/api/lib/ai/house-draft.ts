import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { CATEGORIES, DOW_LABEL, type IsoDow, type RawDraft } from "@app/core";
import { z } from "zod";

// Describe your house: Claude drafts a John list from a sentence or two. A
// small, cheap model is plenty for this, with structured outputs so the answer
// is always JSON of the right shape; core's tidyDraft still checks every value,
// because a schema can't say "between 1 and 10" to the model.

export const DRAFT_MODEL = "claude-haiku-5-5";

/** What Claude is asked to return. Loose on purpose: ranges are core's to enforce. */
const ModelDraft = z.object({
  johns: z.array(
    z.object({
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
    }),
  ),
  groups: z.array(z.object({ name: z.string(), members: z.array(z.string()) })),
  note: z.string().nullable(),
});

/** The house as Claude is told about it: who's in it already, and its week. */
export interface DraftContext {
  description: string;
  /** First names of everyone in the house, the person asking first. */
  people: string[];
  weekStarts: IsoDow;
}

/** Fixed, so it caches: the rules of a good John list. The house itself goes in the user turn. */
const SYSTEM = `You draft the chore list for a shared house in an app called Johns. In Johns a chore is called a John. Each week the app deals the Johns out fairly between the housemates, weighted by effort points, and housemates check each other's ticks.

From the description, draft the Johns this house actually needs: usually 6 to 15. Cover the usual (kitchen, bathroom, bins, floors) even when the description doesn't mention them, and add anything specific the description does mention. Name each John in a few plain words, sentence case ("Bathroom clean", "Bins out").

For each John:
- category: kitchen, bathroom, bins, floors, errands, or other.
- points (effort): 1 for about 5 minutes (taking the bins out), 2 for about 15 minutes, 3 for about half an hour, 5 for about an hour (a deep clean), 8 to 10 only for half a day or more. Similar jobs get similar points.
- everyWeeks: 1 for weekly, 2 for fortnightly, up to 4. Most Johns are weekly; deep cleans and restocking are often fortnightly.
- dueDow (1 Monday ... 7 Sunday) and dueTime (24-hour "HH:MM"): spread Johns across the week rather than piling them on one day. Bins go out the night before collection if the description says the collection day. Bigger jobs suit the weekend.
- onCall: true only for something done whenever it's needed rather than on a day (the kitchen bin when it's full, emptying the dishwasher). Then respondHours (how long whoever is on call has once someone flags it, 1 to 72, usually 6 to 24) and perWeek (about how often it comes up each week, 1 to 14). For other Johns set respondHours 12 and perWeek 2.
- needsPhoto: true only for a job the house is likely to argue about (a deep clean), otherwise false.
- group: null unless only some of the house share the John (two bathrooms, one per floor). Then the group's name, which must be one of the groups you return.
- why: a few words when the choice isn't obvious ("two bathrooms, so one each"), otherwise "".

Groups: only when the description says some people share something the others don't. Name the group after what it's for ("Upstairs"), and list its members by first name as the description gives them; use "me" for the person writing.

note: one or two short sentences on what you assumed that the house should check (a bin day you guessed, a John you left out), or null. Never mention points maths.

The app already handles time away, fairness and reminders, so don't add Johns for those. Only draft chores. If the description isn't about a home at all, return an empty johns list.`;

function userTurn(ctx: DraftContext): string {
  const people = ctx.people.length > 0 ? ctx.people.join(", ") : "only the person writing";
  return [
    `In the house already: ${people} (the first is the person writing). Others the description names haven't joined yet.`,
    `The house's week starts on ${DOW_LABEL[ctx.weekStarts]}.`,
    "",
    "<description>",
    ctx.description,
    "</description>",
  ].join("\n");
}

export interface DraftAnswer {
  raw: RawDraft;
  inputTokens: number;
  outputTokens: number;
}

/** Whether drafting with Claude is set up here: without a key, setup falls back to starter lists. */
export function canDraft(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Ask Claude for a draft. Throws when it can't answer (no key, the API down,
 * a refusal, a cut-off answer); the caller falls back to a starter list.
 */
export async function askClaude(ctx: DraftContext): Promise<DraftAnswer> {
  const client = new Anthropic({ timeout: 25_000, maxRetries: 1 });
  const response = await client.messages.parse({
    model: DRAFT_MODEL,
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(ModelDraft) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userTurn(ctx) }],
  });
  if (response.stop_reason !== "end_turn" || !response.parsed_output) {
    throw new Error(`No draft: ${response.stop_reason}`);
  }
  return {
    raw: response.parsed_output,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
