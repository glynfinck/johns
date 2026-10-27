import type { Outcome } from "./domain";

/**
 * When a John's result becomes final, and what it is.
 *
 * A tick does not count the moment it is made: it stands once the dispute
 * window has passed with no dispute open. The engine calls `settleOutcome`
 * on every unsettled assignment each tick and stamps whatever comes back;
 * `liveStatus` is the same rule read early, for the screens.
 *
 * A cover is a tick by a housemate instead of the assignee (`coveredBy`).
 * It is checked like any tick and, once it stands, settles as `covered`
 * rather than done or late.
 */

export interface AssignmentFacts {
  dueAt: Date;
  doneAt: Date | null;
  excused: boolean;
  /** A dispute has been raised on the current tick and not yet resolved. */
  disputeOpen: boolean;
  weekEndsAt: Date;
  /** Who covered it, when the tick is a housemate's rather than the assignee's. */
  coveredBy?: string | null;
}

const HOUR = 3_600_000;

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
    if (a.coveredBy) return "covered";
    return a.doneAt <= a.dueAt ? "done" : "late";
  }
  if (now >= a.weekEndsAt) return "missed";
  return null;
}

/** What a screen shows for a John right now. */
export type LiveStatus =
  | "upcoming" // not done, due more than a day away
  | "due-soon" // not done, due within a day
  | "overdue" // not done, past due, week still open
  | "checking" // ticked, inside the dispute window
  | "disputed" // ticked, dispute open
  | Outcome; // "covered" from the moment a housemate covers it, while it's checked too

const DAY = 24 * HOUR;

export function liveStatus(
  a: AssignmentFacts & { outcome: Outcome | null },
  now: Date,
  disputeHours: number,
): LiveStatus {
  if (a.outcome) return a.outcome;
  const settled = settleOutcome(a, now, disputeHours);
  if (settled) return settled;
  if (a.doneAt) return a.disputeOpen ? "disputed" : a.coveredBy ? "covered" : "checking";
  if (now > a.dueAt) return "overdue";
  if (a.dueAt.getTime() - now.getTime() <= DAY) return "due-soon";
  return "upcoming";
}

/** Whether a tick on this status would count as on time, late, or not at all. */
export function tickWouldBe(dueAt: Date, now: Date, weekEndsAt: Date): "on-time" | "late" | "closed" {
  if (now >= weekEndsAt) return "closed";
  return now <= dueAt ? "on-time" : "late";
}

/** When a housemate can first cover a John that is still undone. */
export function coverOpensAt(dueAt: Date, graceHours: number): Date {
  return new Date(dueAt.getTime() + graceHours * HOUR);
}

/**
 * Whether `userId` could cover this John now: someone else's, not ticked,
 * excused or settled, and past its due time by the house's grace. The same
 * rule cover_john enforces, read early so a screen only offers what will work.
 */
export function canCover(
  a: { userId: string; doneAt: Date | null; outcome: Outcome | null; excused?: boolean; dueAt: Date },
  userId: string,
  now: Date,
  graceHours: number,
): boolean {
  if (a.userId === userId || a.doneAt || a.outcome || a.excused) return false;
  return now >= coverOpensAt(a.dueAt, graceHours);
}
