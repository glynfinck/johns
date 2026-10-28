// A house's first John list, drafted: from a sentence or two about the house
// (Claude, through POST /api/setup/draft) or from a starter list. Nothing here
// writes anything: a draft is only shown, and an admin keeps what they want
// of it, which then goes on the list like any John added by hand.
import { z } from "zod";

import { CATEGORIES, JOHN_WHEN, type Category, type IsoDow } from "./domain";
import { firstName } from "./format";
import type { JohnDraft } from "./schemas";

/** The most a draft holds: a long list is a list nobody reads. */
export const DRAFT_MAX_JOHNS = 30;
export const DRAFT_MAX_GROUPS = 6;
/** How much of the house a description can say. */
export const DESCRIPTION_MAX = 800;
/** Drafts a house can ask Claude for in a day; starter lists are free and unlimited. */
export const DRAFTS_PER_DAY = 10;

/** POST /api/setup/draft: the house, in the admin's words. */
export const DraftRequest = z.object({
  houseId: z.uuid(),
  description: z
    .string()
    .trim()
    .min(10, "Say a little more about the house: who lives there and what needs doing.")
    .max(DESCRIPTION_MAX, `Keep it under ${DESCRIPTION_MAX} characters.`),
});
export type DraftRequest = z.infer<typeof DraftRequest>;

/** One drafted John: a John as the list holds it, the group that shares it by name, and why it's there. */
export const DraftedJohn = z.object({
  name: z.string().min(1).max(60),
  category: z.enum(CATEGORIES),
  points: z.number().int().min(1).max(10),
  everyWeeks: z.number().int().min(1).max(4),
  dueDow: z.number().int().min(1).max(7),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  needsPhoto: z.boolean(),
  when: z.enum(JOHN_WHEN),
  respondHours: z.number().int().min(1).max(72),
  perWeek: z.number().int().min(1).max(14),
  /** The drafted group that shares it, by name; null for everyone. */
  group: z.string().nullable(),
  /** A few words on why: "two bathrooms, so one each". Empty when it's obvious. */
  why: z.string().max(120),
});
export type DraftedJohn = z.infer<typeof DraftedJohn>;

/** A drafted group: who it's for, as housemates already in the house, and the names that haven't joined yet. */
export const DraftedGroup = z.object({
  name: z.string().min(1).max(40),
  memberIds: z.array(z.uuid()),
  /** Names from the description nobody in the house goes by yet: "Sam", until Sam joins. */
  waitingFor: z.array(z.string()),
});
export type DraftedGroup = z.infer<typeof DraftedGroup>;

export const HouseDraft = z.object({
  johns: z.array(DraftedJohn),
  groups: z.array(DraftedGroup),
  /** One or two sentences on what the draft assumed ("I put the bins on Tuesday night"), or null. */
  note: z.string().nullable(),
});
export type HouseDraft = z.infer<typeof HouseDraft>;

/** Where a draft came from: Claude, or a starter list when Claude wasn't reachable. */
export const DRAFT_SOURCES = ["ai", "starter"] as const;
export type DraftSource = (typeof DRAFT_SOURCES)[number];

export const DraftResponse = z.object({ draft: HouseDraft, source: z.enum(DRAFT_SOURCES) });
export type DraftResponse = z.infer<typeof DraftResponse>;

/**
 * What Claude sends back, before it's checked: every field loose, because a
 * model's numbers can be out of range and its names can be anything. `tidyDraft`
 * turns it into a HouseDraft.
 */
export interface RawDraft {
  johns?: readonly {
    name?: unknown;
    category?: unknown;
    points?: unknown;
    everyWeeks?: unknown;
    dueDow?: unknown;
    dueTime?: unknown;
    needsPhoto?: unknown;
    onCall?: unknown;
    respondHours?: unknown;
    perWeek?: unknown;
    group?: unknown;
    why?: unknown;
  }[];
  groups?: readonly { name?: unknown; members?: unknown }[];
  note?: unknown;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max).trim() : "";
}

/** A whole number in range, or the fallback when it isn't a number at all. */
function whole(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

function time(value: unknown): string {
  const match = typeof value === "string" ? value.trim().match(/^(\d{1,2}):(\d{2})$/) : null;
  if (!match) return "21:00";
  const [h, m] = [Number(match[1]), Number(match[2])];
  return h <= 23 && m <= 59 ? `${String(h).padStart(2, "0")}:${match[2]}` : "21:00";
}

const key = (name: string) => name.toLocaleLowerCase();

type Person = { userId: string; name: string };

/** A name from the description, as one of the house: a full name or a first name, any case. Null if nobody goes by it. */
export function matchPerson(name: string, people: readonly Person[]): string | null {
  const wanted = key(name.trim());
  if (!wanted) return null;
  const exact = people.find((p) => key(p.name) === wanted);
  if (exact) return exact.userId;
  const byFirst = people.filter((p) => key(firstName(p.name)) === key(firstName(wanted)));
  return byFirst.length === 1 ? byFirst[0].userId : null;
}

/**
 * Claude's draft made safe to show: names trimmed and cut to fit, numbers put
 * in range, unknown kinds made "Other", the same John twice kept once, groups
 * matched to the people in the house (`me` stands in for "me" and "I"), and a
 * John's group dropped when no such group was drafted. At most
 * DRAFT_MAX_JOHNS Johns and DRAFT_MAX_GROUPS groups.
 */
export function tidyDraft(raw: RawDraft, people: readonly Person[], me: string): HouseDraft {
  const groups: DraftedGroup[] = [];
  for (const g of raw.groups ?? []) {
    const name = text(g.name, 40);
    if (!name || groups.some((h) => key(h.name) === key(name))) continue;
    const memberIds: string[] = [];
    const waitingFor: string[] = [];
    for (const member of Array.isArray(g.members) ? g.members : []) {
      const who = text(member, 60);
      if (!who) continue;
      const id = /^(me|i|myself)$/i.test(who) ? me : matchPerson(who, people);
      if (id) {
        if (!memberIds.includes(id)) memberIds.push(id);
      } else if (!waitingFor.some((w) => key(w) === key(who))) {
        waitingFor.push(who);
      }
    }
    if (memberIds.length + waitingFor.length === 0) continue;
    groups.push({ name, memberIds, waitingFor });
    if (groups.length === DRAFT_MAX_GROUPS) break;
  }

  const johns: DraftedJohn[] = [];
  for (const j of raw.johns ?? []) {
    const name = text(j.name, 60);
    if (!name || johns.some((k) => key(k.name) === key(name))) continue;
    const groupName = text(j.group, 40);
    const group = groups.find((g) => key(g.name) === key(groupName))?.name ?? null;
    johns.push({
      name,
      category: (CATEGORIES as readonly string[]).includes(j.category as string) ? (j.category as Category) : "other",
      points: whole(j.points, 1, 10, 2),
      everyWeeks: whole(j.everyWeeks, 1, 4, 1),
      dueDow: whole(j.dueDow, 1, 7, 7),
      dueTime: time(j.dueTime),
      needsPhoto: j.needsPhoto === true,
      when: j.onCall === true ? "on_call" : "day",
      respondHours: whole(j.respondHours, 1, 72, 12),
      perWeek: whole(j.perWeek, 1, 14, 2),
      group,
      why: text(j.why, 120),
    });
    if (johns.length === DRAFT_MAX_JOHNS) break;
  }

  // A group no kept John uses is noise on the review screen.
  const used = groups.filter((g) => johns.some((j) => j.group === g.name));
  const note = text(raw.note, 400);
  return { johns, groups: used, note: note || null };
}

/** What keeping some of a draft writes: the groups to make, and each John with the group it goes to. */
export interface DraftPlan {
  /** New groups, by name, with who is in them. */
  makeGroups: { name: string; members: string[] }[];
  /** The Johns to add, as the John list takes them, each with its group's name (made or already there), or null for everyone. */
  johns: { john: Omit<JohnDraft, "id" | "groupId">; groupName: string | null }[];
  /** Johns that go to everyone for now because nobody in their group has joined yet, by name. */
  everyoneForNow: string[];
}

/**
 * Turn the Johns an admin kept into writes. A group already in the house
 * with the same name is used as it is; a drafted group with nobody in the
 * house in it yet can't be made (a group needs someone), so its Johns go to
 * everyone until it's made by hand.
 */
export function draftPlan(draft: HouseDraft, keep: readonly number[], existingGroups: readonly { name: string }[]): DraftPlan {
  const kept = draft.johns.filter((_, i) => keep.includes(i));
  const makeGroups: DraftPlan["makeGroups"] = [];
  const everyoneForNow: string[] = [];
  const johns = kept.map((j) => {
    const john = {
      name: j.name,
      category: j.category,
      points: j.points,
      everyWeeks: j.everyWeeks,
      dueDow: j.dueDow,
      dueTime: j.dueTime,
      needsPhoto: j.needsPhoto,
      when: j.when,
      respondHours: j.respondHours,
      perWeek: j.perWeek,
    };
    let groupName: string | null = null;
    if (j.group) {
      const there = existingGroups.find((g) => key(g.name) === key(j.group!));
      const drafted = draft.groups.find((g) => g.name === j.group);
      if (there) groupName = there.name;
      else if (drafted && drafted.memberIds.length > 0) {
        if (!makeGroups.some((g) => g.name === drafted.name)) makeGroups.push({ name: drafted.name, members: [...drafted.memberIds] });
        groupName = drafted.name;
      } else everyoneForNow.push(j.name);
    }
    return { john, groupName };
  });
  return { makeGroups, johns, everyoneForNow };
}

// --- Starter lists ------------------------------------------------------------

export const STARTER_KINDS = ["flat_share", "couple", "family"] as const;
export type StarterKind = (typeof STARTER_KINDS)[number];

type Starter = [name: string, category: Category, points: number, everyWeeks: number, dueDow: IsoDow, dueTime: string, extra?: Partial<DraftedJohn>];

function starter(rows: readonly Starter[]): DraftedJohn[] {
  return rows.map(([name, category, points, everyWeeks, dueDow, dueTime, extra]) => ({
    name,
    category,
    points,
    everyWeeks,
    dueDow,
    dueTime,
    needsPhoto: false,
    when: "day",
    respondHours: 12,
    perWeek: 2,
    group: null,
    why: "",
    ...extra,
  }));
}

/** The kitchen bin as an on-call John: whoever is on call takes it out when someone flags it. */
const BIN_ON_CALL: Partial<DraftedJohn> = { when: "on_call", respondHours: 12, perWeek: 3 };

/**
 * Ready-made lists for when Claude can't be reached, or for an admin who'd
 * rather start from one. Points follow the John list's hint: 1 for taking
 * the bins out, 5 for a deep clean. Due days are spread over the week.
 */
export const STARTER_LISTS: Record<StarterKind, DraftedJohn[]> = {
  flat_share: starter([
    ["Kitchen wipe-down", "kitchen", 2, 1, 3, "21:00"],
    ["Kitchen deep clean", "kitchen", 5, 2, 7, "18:00"],
    ["Fridge clear-out", "kitchen", 2, 2, 5, "21:00"],
    ["Bathroom clean", "bathroom", 4, 1, 6, "18:00"],
    ["Kitchen bin", "bins", 1, 1, 7, "21:00", BIN_ON_CALL],
    ["Bins and recycling out", "bins", 1, 1, 2, "21:00"],
    ["Hoover and mop", "floors", 3, 1, 7, "18:00"],
    ["Loo roll and cleaning stuff", "errands", 1, 2, 4, "21:00"],
  ]),
  couple: starter([
    ["Kitchen clean", "kitchen", 3, 1, 3, "21:00"],
    ["Bathroom clean", "bathroom", 4, 1, 6, "18:00"],
    ["Bins and recycling out", "bins", 1, 1, 2, "21:00"],
    ["Hoover and mop", "floors", 3, 1, 7, "18:00"],
    ["Laundry", "other", 3, 1, 4, "21:00"],
    ["Change the sheets", "other", 2, 2, 7, "21:00"],
    ["Food shop", "errands", 3, 1, 6, "13:00"],
  ]),
  family: starter([
    ["Kitchen clean", "kitchen", 3, 1, 3, "20:00"],
    ["Empty the dishwasher", "kitchen", 1, 1, 7, "20:00", { when: "on_call", respondHours: 6, perWeek: 5 }],
    ["Bathroom clean", "bathroom", 4, 1, 6, "18:00"],
    ["Bins and recycling out", "bins", 1, 1, 2, "20:00"],
    ["Hoover downstairs", "floors", 2, 1, 7, "18:00"],
    ["Tidy your bedroom", "other", 2, 1, 7, "19:00"],
    ["Laundry", "other", 3, 1, 4, "20:00"],
    ["Food shop", "errands", 3, 1, 6, "13:00"],
  ]),
};

/** A starter list as a draft, the same shape Claude's comes in. */
export function starterDraft(kind: StarterKind): HouseDraft {
  return { johns: STARTER_LISTS[kind].map((j) => ({ ...j })), groups: [], note: null };
}

/** Which starter list fits a description best, for when Claude can't draft from it: a family, a couple, or else a flat share. */
export function guessStarter(description: string): StarterKind {
  const d = description.toLocaleLowerCase();
  if (/\b(kids?|children|child|son|daughter|family|toddler|teenagers?|mum|dad)\b/.test(d)) return "family";
  if (/\b(partner|girlfriend|boyfriend|wife|husband|fianc[eé]e?|couple|two of us|me and my|my other half)\b/.test(d)) return "couple";
  return "flat_share";
}
