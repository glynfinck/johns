import { z } from "zod";

import { CATEGORIES, CURRENCIES, JOHN_WHEN } from "./domain";
import { PASS_PURCHASES } from "./pass";

// Shapes the apps and the API agree on. The API validates requests with
// these and the native app parses responses with them; the web's server
// actions validate their input with the same ones.

/**
 * A join code's alphabet: new_join_code's, with no look-alikes (no 0/O,
 * 1/I/L), so a code read aloud or typed from a screenshot survives.
 */
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 8;

const JOIN_CODE = new RegExp(`^[${JOIN_CODE_ALPHABET}]{${JOIN_CODE_LENGTH}}$`);

/**
 * A join code as people type it: any case, spaces or dashes between pairs,
 * tidied to the database's eight characters. Null when it can't be one, so a
 * typo is caught before it reaches the house.
 */
export function normaliseJoinCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  return JOIN_CODE.test(code) ? code : null;
}

export const JoinCode = z.string().transform((value, ctx) => {
  const code = normaliseJoinCode(value);
  if (!code) {
    ctx.addIssue({ code: "custom", message: "A join code is eight letters and numbers." });
    return z.NEVER;
  }
  return code;
});

/** Setting up a house: what create_house takes. */
export const CreateHouse = z.object({
  name: z.string().trim().min(1, "Give the house a name.").max(60),
  timezone: z.string().min(1),
  currency: z.enum(CURRENCIES),
  weekStarts: z.coerce.number().int().min(1).max(7),
});
export type CreateHouse = z.infer<typeof CreateHouse>;

/** How long a tick can be disputed, in hours: 0 is the honour system. */
export const DISPUTE_HOURS = [0, 6, 12, 24, 48, 72] as const;

/** How long past its due time a John stays its owner's before a housemate can cover it (houses.cover_grace_hours). */
export const COVER_GRACE_HOURS = [0, 1, 3, 6, 12, 24] as const;

/** How long past its due time a John can still be done late, before it's missed (houses.late_hours). */
export const LATE_HOURS = [12, 24, 48, 72] as const;

/** How much of a share time away still owes, in percent (houses.away_makeup). */
export const AWAY_MAKEUP = [100, 50, 0] as const;

/** The most a stake or a forfeit can be, in minor units: 1,000 of the currency. */
export const MAX_AMOUNT_MINOR = 100_000;

const amount = z.coerce
  .number()
  .int()
  .min(0, "Amounts can’t be negative.")
  .max(MAX_AMOUNT_MINOR, "Amounts are up to 1,000.");

/** The house rules an admin can change: the houses columns granted to them. */
export const HouseSettings = z.object({
  name: z.string().trim().min(1, "Give the house a name.").max(60),
  timezone: z.string().trim().min(1, "Say which time zone the house is in."),
  currency: z.enum(CURRENCIES),
  weekStarts: z.coerce.number().int().min(1).max(7),
  stakeMinor: amount,
  lateForfeitMinor: amount,
  missedForfeitMinor: amount,
  disputeHours: z.coerce.number().int().min(0).max(72),
  /** Absent from a form that doesn't show it (the older web's), which leaves the house's as it is. */
  coverGraceHours: z.coerce.number().int().min(0).max(48).optional(),
  /** Absent from a form that doesn't show it, like coverGraceHours. */
  lateHours: z.coerce.number().int().min(1).max(72).optional(),
  awayMakeup: z.coerce.number().int().refine((n) => (AWAY_MAKEUP as readonly number[]).includes(n)),
});
export type HouseSettings = z.infer<typeof HouseSettings>;

/** One John on the house's list, as an admin adds or edits it. `id` is absent for a new one. */
export const JohnDraft = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Name the John.").max(60),
  category: z.enum(CATEGORIES),
  points: z.coerce.number().int().min(1).max(10),
  everyWeeks: z.coerce.number().int().min(1).max(4),
  dueDow: z.coerce.number().int().min(1).max(7),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Give a time like 21:00."),
  needsPhoto: z.boolean(),
  groupId: z.uuid().nullable(),
  // On call (johns.kind): its window and its weight in the deal. A John due on
  // a day keeps its due day and time for if it goes back to one.
  when: z.enum(JOHN_WHEN).default("day"),
  respondHours: z.coerce.number().int().min(1, "Give between 1 and 72 hours.").max(72, "Give between 1 and 72 hours.").default(12),
  perWeek: z.coerce.number().int().min(1).max(14).default(2),
});
export type JohnDraft = z.infer<typeof JohnDraft>;

/** A group of housemates who share some Johns (one of two bathrooms): what save_group takes. */
export const GroupDraft = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Name the group.").max(40),
  members: z.array(z.uuid()).min(1, "Pick at least one housemate."),
});
export type GroupDraft = z.infer<typeof GroupDraft>;

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Time away you book for yourself: local first and last days, inclusive, and where. set_away decides the rest. */
export const AwayDraft = z.object({
  from: z.string().regex(LOCAL_DATE, "Pick the first day you’re away."),
  to: z.string().regex(LOCAL_DATE, "Pick the last day you’re away."),
  note: z.string().trim().max(60).optional(),
});
export type AwayDraft = z.infer<typeof AwayDraft>;

/** A name you go by: what renaming yourself writes to profiles.display_name. */
export const DisplayName = z.string().trim().min(1, "Names are 1 to 60 characters.").max(60, "Names are 1 to 60 characters.");

/** Every API error: `{ "error": "..." }`, a sentence fit to show. */
export const ApiError = z.object({ error: z.string() });
export type ApiError = z.infer<typeof ApiError>;

/** POST /api/fresh: catch this house up before showing it. */
export const FreshRequest = z.object({ houseId: z.uuid() });
export type FreshRequest = z.infer<typeof FreshRequest>;

/** `ticked`: false when the house was already caught up in the last minute. */
export const FreshResponse = z.object({ ticked: z.boolean() });
export type FreshResponse = z.infer<typeof FreshResponse>;

/** POST /api/disputes: say a housemate's tick wasn't really done. */
export const RaiseDispute = z.object({
  assignmentId: z.uuid(),
  reason: z.string().trim().min(1, "Say what’s wrong with it.").max(280, "Keep it under 280 characters."),
});
export type RaiseDispute = z.infer<typeof RaiseDispute>;

/** The sentence for a RaiseDispute that didn't parse: the reason's own, or which John. */
export function disputeProblem(issues: readonly { path: readonly PropertyKey[]; message: string }[]): string {
  return issues.find((issue) => issue.path[0] === "reason")?.message ?? "Say which John to dispute.";
}

/** POST /api/disputes/:id/votes: `uphold` true says it wasn't done. */
export const CastVote = z.object({ uphold: z.boolean() });
export type CastVote = z.infer<typeof CastVote>;

/** POST /api/deal: hand out this week's Johns, or re-deal a week nobody has ticked in. */
export const DealRequest = z.object({ houseId: z.uuid() });
export type DealRequest = z.infer<typeof DealRequest>;

/** POST /api/flags: say an on-call John needs doing. */
export const RaiseFlag = z.object({ johnId: z.uuid() });
export type RaiseFlag = z.infer<typeof RaiseFlag>;

/** The flag it opened, or the one already open: whoever is on call ticks that. */
export const FlagResponse = z.object({ ok: z.literal(true), assignmentId: z.uuid() });
export type FlagResponse = z.infer<typeof FlagResponse>;

/** POST /api/pass/checkout: buy the House Pass for a house, on the web. */
export const PassCheckoutRequest = z.object({ houseId: z.uuid(), plan: z.enum(PASS_PURCHASES) });
export type PassCheckoutRequest = z.infer<typeof PassCheckoutRequest>;

/** POST /api/pass/manage: the buyer changes or cancels the house's plan. */
export const PassManageRequest = z.object({ houseId: z.uuid() });
export type PassManageRequest = z.infer<typeof PassManageRequest>;

/** Where to send the browser next: Stripe's checkout or its billing page. */
export const PassRedirect = z.object({ url: z.url() });
export type PassRedirect = z.infer<typeof PassRedirect>;

/** What a move answers when the database took it. */
export const MoveResponse = z.object({ ok: z.literal(true) });
export type MoveResponse = z.infer<typeof MoveResponse>;
