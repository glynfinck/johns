import type { Outcome } from "./domain";

/**
 * Streaks and perks.
 *
 * A clean week is one where every John you had was done on time or excused.
 * A late one breaks it, and so does a missed one. A week where you had no
 * Johns at all neither builds nor breaks it.
 *
 * Two perks come out of this:
 *   - an immunity token every IMMUNITY_EVERY clean weeks in a row, held up to
 *     IMMUNITY_CAP, spent to excuse one John with no forfeit;
 *   - a swap token for topping a week's table (points.ts weekWinners),
 *     held up to SWAP_CAP, spent to trade one of your open Johns for a
 *     housemate's. That is "first pick", for a house on fair shares.
 */

export const IMMUNITY_EVERY = 4;
export const IMMUNITY_CAP = 2;
export const SWAP_CAP = 1;

/** true, false, or null for a week with nothing in it. */
export function isCleanWeek(outcomes: readonly Outcome[]): boolean | null {
  if (outcomes.length === 0) return null;
  return outcomes.every((o) => o === "done" || o === "excused");
}

/** Consecutive clean weeks, counting back from the most recent closed week. */
export function streakLength(weeksOldestFirst: readonly (readonly Outcome[])[]): number {
  let n = 0;
  for (let i = weeksOldestFirst.length - 1; i >= 0; i--) {
    const clean = isCleanWeek(weeksOldestFirst[i]);
    if (clean === null) continue;
    if (!clean) break;
    n += 1;
  }
  return n;
}

/** Does closing a week that took a streak from `before` to `after` earn immunity? */
export function earnsImmunity(before: number, after: number): boolean {
  return after > before && after % IMMUNITY_EVERY === 0;
}

/** Add one token without going over the cap. */
export function grantToken(held: number, cap: number): number {
  return Math.min(held + 1, cap);
}
