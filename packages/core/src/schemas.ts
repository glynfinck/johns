import { z } from "zod";

import { CURRENCIES } from "./domain";

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
  reason: z.string().trim().min(1, "Say what's wrong with it.").max(280, "Keep it under 280 characters."),
});
export type RaiseDispute = z.infer<typeof RaiseDispute>;

/** The sentence for a RaiseDispute that didn't parse: the reason's own, or which John. */
export function disputeProblem(issues: readonly { path: readonly PropertyKey[]; message: string }[]): string {
  return issues.find((issue) => issue.path[0] === "reason")?.message ?? "Say which John to dispute.";
}

/** POST /api/disputes/:id/votes: `uphold` true says it wasn't done. */
export const CastVote = z.object({ uphold: z.boolean() });
export type CastVote = z.infer<typeof CastVote>;

/** What a move answers when the database took it. */
export const MoveResponse = z.object({ ok: z.literal(true) });
export type MoveResponse = z.infer<typeof MoveResponse>;
