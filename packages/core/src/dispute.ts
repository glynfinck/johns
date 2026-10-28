/**
 * Housemate check: when a disputed tick is struck or stands.
 *
 * Everyone but the person whose tick it is gets a vote, and raising the
 * dispute counts as a vote to strike it. Striking a tick takes a majority of
 * everyone who may vote, not just of those who did: housemates who say
 * nothing leave it standing, so one objection on its own never strikes a tick
 * in a house of three or more. The tick stands as soon as a strike can no
 * longer reach a majority, or when the vote closes without one. "The tick
 * stands unless the house says otherwise."
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
  const cannotStrike = eligible - t.reject < majority;
  if (cannotStrike || now >= t.closesAt) return "rejected";
  return null;
}
