import type { Outcome } from "./domain";

/**
 * When a John's result becomes final, and what it is.
 *
 * A tick does not count the moment it is made: it stands once the dispute
 * window has passed with no dispute open. The engine calls `settleOutcome`
 * on every unsettled assignment each tick and stamps whatever comes back;
 * `liveStatus` is the same rule read early, for the screens.
 */

export interface AssignmentFacts {
  dueAt: Date;
  doneAt: Date | null;
  excused: boolean;
  /** A dispute has been raised on the current tick and not yet resolved. */
  disputeOpen: boolean;
  weekEndsAt: Date;
  /** Set on an on-call John's flag: when it was raised (its due time is this plus the John's window). */
  flaggedAt?: Date | null;
}

const HOUR = 3_600_000;

/**
 * When an open John turns missed. A John due on a day: when its week ends.
 * A flag: at twice its window (raised at 8pm with 12 hours, missed at 8pm the
 * next day), or when its week ends if it is overdue by then. A flag never
 * passes to whoever is on call next week: it stays missed or done by whoever
 * had it. The database's closes_at says the same.
 */
export function flagClosesAt(a: Pick<AssignmentFacts, "dueAt" | "weekEndsAt" | "flaggedAt">): Date {
  if (!a.flaggedAt) return a.weekEndsAt;
  const missAt = new Date(a.dueAt.getTime() * 2 - a.flaggedAt.getTime());
  if (a.dueAt < a.weekEndsAt) return missAt < a.weekEndsAt ? missAt : a.weekEndsAt;
  return missAt;
}

export function standsAt(doneAt: Date, disputeHours: number): Date {
  return new Date(doneAt.getTime() + disputeHours * HOUR);
}

/** The final outcome, or null while the house can still change it. */
export function settleOutcome(
  a: AssignmentFacts,
  now: Date,
  disputeHours: number,
): Outcome | null {
  if (a.excused) return "excused";
  if (a.doneAt) {
    if (a.disputeOpen) return null;
    if (now < standsAt(a.doneAt, disputeHours)) return null;
    return a.doneAt <= a.dueAt ? "done" : "late";
  }
  if (now >= flagClosesAt(a)) return "missed";
  return null;
}

/** What a screen shows for a John right now. */
export type LiveStatus =
  | "upcoming" // not done, due more than a day away
  | "due-soon" // not done, due within a day
  | "overdue" // not done, past due, week still open
  | "checking" // ticked, inside the dispute window
  | "disputed" // ticked, dispute open
  | Outcome;

const DAY = 24 * HOUR;

export function liveStatus(
  a: AssignmentFacts & { outcome: Outcome | null },
  now: Date,
  disputeHours: number,
): LiveStatus {
  if (a.outcome) return a.outcome;
  const settled = settleOutcome(a, now, disputeHours);
  if (settled) return settled;
  if (a.doneAt) return a.disputeOpen ? "disputed" : "checking";
  if (now > a.dueAt) return "overdue";
  if (a.dueAt.getTime() - now.getTime() <= DAY) return "due-soon";
  return "upcoming";
}

/** Whether a tick on this status would count as on time, late, or not at all. */
export function tickWouldBe(dueAt: Date, now: Date, weekEndsAt: Date): "on-time" | "late" | "closed" {
  if (now >= weekEndsAt) return "closed";
  return now <= dueAt ? "on-time" : "late";
}
