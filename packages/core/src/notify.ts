import { tz } from "@date-fns/tz";
import { getHours } from "date-fns";
import { z } from "zod";

/**
 * What each housemate wants pushed to them, and when to keep quiet. One row
 * per person (`notification_prefs`), the same on every device; no row means
 * everything on and no quiet hours. Pure: the engine and the push sender
 * pass `now`.
 */

/** The kinds of push the app sends, each one switched on or off on its own. */
export const PUSH_KINDS = ["reminders", "checks", "flags", "deal"] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

export interface NotificationPrefs {
  reminders: boolean;
  checks: boolean;
  flags: boolean;
  deal: boolean;
  /** Quiet from this hour (0–23) until `quietUntil`, in `timezone`. Both or neither. */
  quietFrom: number | null;
  quietUntil: number | null;
  /** The zone the hours are in: the device's when they were saved. Null falls back to the house's. */
  timezone: string | null;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  reminders: true,
  checks: true,
  flags: true,
  deal: true,
  quietFrom: null,
  quietUntil: null,
  timezone: null,
};

/** A `notification_prefs` row as the app reads it, or the defaults when there's none. */
export function prefsOf(
  row: {
    reminders: boolean;
    checks: boolean;
    flags: boolean;
    deal: boolean;
    quiet_from: number | null;
    quiet_until: number | null;
    timezone: string | null;
  } | null | undefined,
): NotificationPrefs {
  if (!row) return DEFAULT_PREFS;
  return {
    reminders: row.reminders,
    checks: row.checks,
    flags: row.flags,
    deal: row.deal,
    quietFrom: row.quiet_from,
    quietUntil: row.quiet_until,
    timezone: row.timezone,
  };
}

/**
 * Whether `now` falls in someone's quiet hours. The hours run from
 * `quietFrom` up to (not including) `quietUntil`, past midnight when
 * `quietFrom` is the later one: 22 to 7 is quiet from 22:00 to 06:59.
 */
export function inQuietHours(prefs: NotificationPrefs, now: Date, houseZone: string): boolean {
  const { quietFrom: from, quietUntil: until } = prefs;
  if (from === null || until === null || from === until) return false;
  const hour = getHours(now, { in: tz(prefs.timezone ?? houseZone) });
  return from < until ? hour >= from && hour < until : hour >= from || hour < until;
}

/**
 * What to do with a push of this kind, now: send it, send it without a
 * sound (quiet hours), or not at all (that kind is off). Something that
 * happened (a dispute, a flag, the deal) arrives quietly rather than late.
 */
export function pushFor(prefs: NotificationPrefs, kind: PushKind, now: Date, houseZone: string): "send" | "quiet" | "skip" {
  if (!prefs[kind]) return "skip";
  return inQuietHours(prefs, now, houseZone) ? "quiet" : "send";
}

/**
 * A reminder is different: it can wait. In quiet hours it's held for a later
 * tick, so "due tomorrow" arrives in the morning instead of in silence at 3am.
 */
export function reminderFor(prefs: NotificationPrefs, now: Date, houseZone: string): "send" | "wait" | "skip" {
  if (!prefs.reminders) return "skip";
  return inQuietHours(prefs, now, houseZone) ? "wait" : "send";
}

const Hour = z.number().int().min(0).max(23);

/** Saving your notification settings. Quiet hours are both set or both cleared. */
export const NotificationPrefsDraft = z
  .object({
    reminders: z.boolean(),
    checks: z.boolean(),
    flags: z.boolean(),
    deal: z.boolean(),
    quietFrom: Hour.nullable(),
    quietUntil: Hour.nullable(),
    timezone: z.string().min(1).nullable(),
  })
  .refine((p) => (p.quietFrom === null) === (p.quietUntil === null), {
    message: "Pick when quiet hours start and end.",
  })
  .refine((p) => p.quietFrom === null || p.quietFrom !== p.quietUntil, {
    message: "Quiet hours need to end at a different hour from when they start.",
  });
export type NotificationPrefsDraft = z.infer<typeof NotificationPrefsDraft>;

/**
 * POST /api/push-actions: a button on a notification. The token came with
 * the push and says who and what (apps/api/lib/push-token.ts); the action is
 * which button: "done" ticks a John, "held" and "struck" answer a housemate
 * check (it was done, it wasn't).
 */
export const PushActionRequest = z.object({
  token: z.string().min(1).max(2000),
  action: z.enum(["done", "held", "struck"]),
});
export type PushActionRequest = z.infer<typeof PushActionRequest>;

/** What the notification says once the button has worked. */
export const PushActionResponse = z.object({ ok: z.literal(true), title: z.string(), body: z.string() });
export type PushActionResponse = z.infer<typeof PushActionResponse>;
