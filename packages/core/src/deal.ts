/**
 * Fair shares: who gets which John this week.
 *
 * Pure and deterministic. The engine hands it the week's Johns (who shares
 * each one, and which of them are home on the day it is due), each
 * housemate's balance from recent weeks, and their share of this week; it
 * hands back assignments. Same inputs, same deal, on any machine, which is
 * what lets a test pin it.
 *
 * What a share is (weekShares):
 *   - A John is split equally among the people who share it: the whole house,
 *     or the group it belongs to. Three on the upstairs bathroom owe a third
 *     each; two on the downstairs one owe half each.
 *   - Someone away on the day it is due is never handed it, but still owes
 *     their part, times the house's make-up rate (in full, half or none). The
 *     rest is split among the sharers who are home.
 *   - If nobody who shares it is home, it is skipped this week.
 *
 * A balance is the work someone did minus their share, over recent weeks
 * (carryOver). A John counts for whoever did it: done or late, for its
 * holder; covered, for whoever covered it; skipped with immunity or excused,
 * for its holder, since that's the house letting them off. A missed John
 * counts for nobody, so it comes back to whoever missed it in the next
 * deals, and covering for someone means you're dealt less later. Away is not
 * a holiday from your share: it shows up as a balance below zero, and the
 * weeks after hand you a little more until it evens out.
 *
 * Who gets what (fairShares), in order of what matters:
 *   1. Balances even out. Each John goes to whoever, of those home to do it,
 *      would be furthest behind: their balance, plus this week's Johns so far,
 *      minus their share of this week.
 *   2. Catching up is gradual. Nobody is handed more than half as much again
 *      as their share while someone else could take the John (CATCH_UP_PACE).
 *   3. Variety. Doing the same John as last time costs a small penalty, so
 *      the bathroom moves around when balances are close.
 *   4. Spread: ties go to whoever has fewer Johns this week. Then a seeded
 *      shuffle, so ties do not always fall the same way.
 */

export interface DealJohn {
  johnId: string;
  points: number;
  /** Who did this John the last time it was handed out. */
  lastUserId: string | null;
  /** Everyone who shares it: the house, or its group. */
  sharers: readonly string[];
  /** The sharers who are home on the day it is due. */
  home: readonly string[];
}

export interface DealMember {
  userId: string;
  /** Recent weeks: the work they did minus their share. Below zero means behind. */
  balance: number;
  /** Their share of this week. */
  share: number;
}

export interface DealAssignment {
  johnId: string;
  userId: string;
}

/** The cost, in points, of giving someone the same John twice running. */
export const REPEAT_PENALTY = 1.5;

/** The most extra one week hands someone catching up, as a fraction of their share. */
export const CATCH_UP_PACE = 0.5;

/** How many past weeks a balance remembers: enough to pay back a month away at that pace. */
export const BALANCE_WEEKS = 12;

/** What time away still owes, by the house's setting (houses.away_makeup). */
export const MAKEUP_LABEL: Record<number, string> = {
  100: "In full",
  50: "Half",
  0: "Not at all",
};

/** A small, stable string hash (FNV-1a), for tie-breaking only. */
export function stableHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Whether anyone who shares a John is home to do it. A John nobody can do is skipped. */
export function canDeal(john: Pick<DealJohn, "sharers" | "home">): boolean {
  return john.home.some((id) => john.sharers.includes(id));
}

/**
 * Each housemate's share of a week. `makeup` is how much of their part an
 * away sharer still owes: 1 in full, 0.5 half, 0 none.
 */
export function weekShares(
  johns: readonly DealJohn[],
  memberIds: readonly string[],
  makeup: number,
): Map<string, number> {
  const share = new Map(memberIds.map((id) => [id, 0]));
  for (const john of johns) {
    const sharers = john.sharers.filter((id) => share.has(id));
    const home = john.home.filter((id) => sharers.includes(id));
    if (home.length === 0) continue;
    const part = john.points / sharers.length;
    const away = sharers.filter((id) => !home.includes(id));
    const owedAway = part * makeup;
    for (const id of away) share.set(id, share.get(id)! + owedAway);
    const homePart = (john.points - owedAway * away.length) / home.length;
    for (const id of home) share.set(id, share.get(id)! + homePart);
  }
  return share;
}

export function fairShares(
  johns: readonly DealJohn[],
  members: readonly DealMember[],
  seed: string,
): DealAssignment[] {
  const byId = new Map(members.map((m) => [m.userId, m]));
  const state = new Map(members.map((m) => [m.userId, { assigned: 0, count: 0 }]));

  const ordered = [...johns].sort((a, b) => b.points - a.points || a.johnId.localeCompare(b.johnId));

  const out: DealAssignment[] = [];
  for (const john of ordered) {
    const candidates = john.home.filter((id) => byId.has(id) && john.sharers.includes(id));
    if (candidates.length === 0) continue;
    // Shares are sums of fractions (a third of a point, six times over), so
    // the cap allows for rounding rather than refuse a John by 1e-15.
    const roomy = candidates.filter(
      (id) => state.get(id)!.assigned + john.points <= byId.get(id)!.share * (1 + CATCH_UP_PACE) + 1e-9,
    );
    const pool = roomy.length > 0 ? roomy : candidates;

    let best: { userId: string; key: [number, number, number] } | null = null;
    for (const id of pool) {
      const m = byId.get(id)!;
      const s = state.get(id)!;
      const behind = m.balance + s.assigned - m.share + (id === john.lastUserId ? REPEAT_PENALTY : 0);
      const key: [number, number, number] = [behind, s.count, stableHash(`${seed}:${john.johnId}:${id}`)];
      if (!best || lessThan(key, best.key)) best = { userId: id, key };
    }
    const chosen = state.get(best!.userId)!;
    chosen.assigned += john.points;
    chosen.count += 1;
    out.push({ johnId: john.johnId, userId: best!.userId });
  }
  return out;
}

function lessThan(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

export interface PastJohn {
  /** Whose John it was. */
  userId: string;
  points: number;
  /** How it ended; null (or absent) while it can still change. */
  outcome?: string | null;
  /** Who covered it, if a housemate did. */
  coveredBy?: string | null;
}

export interface PastWeek {
  /** Each housemate's share of the week, as stored when it was dealt. */
  shares: readonly { userId: string; share: number }[];
  assignments: readonly PastJohn[];
}

/**
 * Who a past John counts for: whoever covered it, nobody if it was missed,
 * otherwise its holder (done, late, excused, or not settled yet, which counts
 * as theirs until it is).
 */
export function creditedTo(a: PastJohn): string | null {
  if (a.coveredBy) return a.coveredBy;
  if (a.outcome === "missed") return null;
  return a.userId;
}

/**
 * Each current housemate's balance: the work they did in recent weeks
 * (creditedTo) minus their share of those weeks. Someone who joins part-way
 * starts at zero, since they had no share of the weeks before them.
 */
export function carryOver(weeks: readonly PastWeek[], currentMemberIds: readonly string[]): Map<string, number> {
  const balance = new Map(currentMemberIds.map((id) => [id, 0]));
  for (const week of weeks) {
    for (const s of week.shares) {
      if (balance.has(s.userId)) balance.set(s.userId, balance.get(s.userId)! - s.share);
    }
    for (const a of week.assignments) {
      const who = creditedTo(a);
      if (who && balance.has(who)) balance.set(who, balance.get(who)! + a.points);
    }
  }
  return balance;
}

/** The recent weeks as read: their ids, the shares stored when each was dealt, and each John in them with how it ended. */
export interface RecentRows {
  weekIds: readonly string[];
  shares: readonly { week_id: string; user_id: string; share: number | string }[];
  handed: readonly {
    week_id: string;
    user_id: string;
    points: number;
    outcome?: string | null;
    covered_by?: string | null;
  }[];
}

/**
 * Each current housemate's balance over the recent weeks (`carryOver`), and
 * their usual week's share: the average of the weeks they had one, for
 * saying how long catching up takes.
 */
export function recentBalances(
  rows: RecentRows,
  memberIds: readonly string[],
): { balances: Map<string, number>; usualShare: Map<string, number> } {
  const weeks: PastWeek[] = rows.weekIds.map((id) => ({
    shares: rows.shares.filter((s) => s.week_id === id).map((s) => ({ userId: s.user_id, share: Number(s.share) })),
    assignments: rows.handed
      .filter((a) => a.week_id === id)
      .map((a) => ({ userId: a.user_id, points: a.points, outcome: a.outcome, coveredBy: a.covered_by })),
  }));
  const usualShare = new Map<string, number>();
  for (const id of memberIds) {
    const theirs = rows.shares.filter((s) => s.user_id === id && Number(s.share) > 0).map((s) => Number(s.share));
    usualShare.set(id, theirs.length ? theirs.reduce((a, b) => a + b, 0) / theirs.length : 0);
  }
  return { balances: carryOver(weeks, memberIds), usualShare };
}

export interface BalanceRow {
  userId: string;
  /** Work done minus share over recent weeks, going into this week. Below zero is behind. */
  balance: number;
  /** About how many weeks of catching up are left at the catch-up pace. */
  weeksToEven: number;
}

/** Everyone's balance against their share, furthest behind first. */
export function balanceRows(
  balances: ReadonlyMap<string, number>,
  usualShare: ReadonlyMap<string, number>,
  memberIds: readonly string[],
): BalanceRow[] {
  return memberIds
    .map((id) => {
      const balance = balances.get(id) ?? 0;
      return { userId: id, balance, weeksToEven: catchUpWeeks(balance, usualShare.get(id) ?? 0) };
    })
    .sort((a, b) => a.balance - b.balance);
}

/**
 * Roughly how many weeks someone behind will take to even out at the
 * catch-up pace, given what a usual week's share is for them. Zero when they
 * are level or ahead.
 */
export function catchUpWeeks(balance: number, usualShare: number): number {
  if (balance > -0.5 || usualShare <= 0) return 0;
  return Math.ceil(-balance / (usualShare * CATCH_UP_PACE));
}
