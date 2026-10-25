/**
 * Housemate check: when a disputed tick is struck or stands.
 *
 * Everyone but the person whose tick it is gets a vote, and raising the
 * dispute counts as a vote to strike it. A majority of those voters decides
 * at once; otherwise the vote closes on time and the larger side wins, with a
 * tie going to the tick. "The tick stands unless the house says otherwise."
 */

export type Verdict = "upheld" | "rejected";

export interface Tally {
  /** Housemates allowed to vote: everyone except the person who ticked. */
  eligible: number;
  uphold: number;
  reject: number;
  closesAt: Date;
}

export function verdict(t: Tally, now: Date): Verdict | null {
  const eligible = Math.max(1, t.eligible);
  const majority = Math.floor(eligible / 2) + 1;
  if (t.uphold >= majority) return "upheld";
  if (t.reject >= majority) return "rejected";
  const everyoneVoted = t.uphold + t.reject >= eligible;
  if (everyoneVoted || now >= t.closesAt) return t.uphold > t.reject ? "upheld" : "rejected";
  return null;
}
