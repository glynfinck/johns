/**
 * Fair shares: who gets which Johh this week.
 *
 * Pure and deterministic. The engine hands it the week's Johhs, the house,
 * and how much each person has carried lately; it hands back assignments.
 * Same inputs, same rota, on any machine, which is what lets a test pin it.
 *
 * The rule, in order of what matters:
 *   1. Effort evens out. Each Johh goes to whoever has the lightest load once
 *      their recent carry-over and this week's Johhs so far are counted.
 *   2. Variety. Doing the same Johh as last time costs a small penalty, so
 *      the bathroom moves around when loads are close, but fairness wins
 *      when they are not.
 *   3. Spread. Ties go to whoever has fewer Johhs this week.
 *   4. Then a seeded shuffle, so ties do not always fall the same way.
 */

export interface RotaJohh {
  johhId: string;
  points: number;
  /** Who did this Johh the last time it was handed out. */
  lastUserId: string | null;
}

export interface RotaMember {
  userId: string;
  /** Points carried over from recent weeks: positive means they did more than their share. */
  carry: number;
}

export interface RotaAssignment {
  johhId: string;
  userId: string;
}

/** The cost, in points, of giving someone the same Johh twice running. */
export const REPEAT_PENALTY = 1.5;

/** A small, stable string hash (FNV-1a), for tie-breaking only. */
export function stableHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function fairShares(
  johhs: readonly RotaJohh[],
  members: readonly RotaMember[],
  seed: string,
): RotaAssignment[] {
  if (members.length === 0) return [];

  const minCarry = Math.min(...members.map((m) => m.carry));
  const state = new Map(
    members.map((m) => [m.userId, { load: m.carry - minCarry, count: 0 }]),
  );

  const ordered = [...johhs].sort(
    (a, b) => b.points - a.points || a.johhId.localeCompare(b.johhId),
  );

  const out: RotaAssignment[] = [];
  for (const johh of ordered) {
    let best: { userId: string; key: [number, number, number] } | null = null;
    for (const m of members) {
      const s = state.get(m.userId)!;
      const score = s.load + (m.userId === johh.lastUserId ? REPEAT_PENALTY : 0);
      const key: [number, number, number] = [
        score,
        s.count,
        stableHash(`${seed}:${johh.johhId}:${m.userId}`),
      ];
      if (!best || lessThan(key, best.key)) best = { userId: m.userId, key };
    }
    const chosen = state.get(best!.userId)!;
    chosen.load += johh.points;
    chosen.count += 1;
    out.push({ johhId: johh.johhId, userId: best!.userId });
  }
  return out;
}

function lessThan(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

export interface PastWeek {
  /** Everyone who was in the house that week, assigned or not. */
  memberIds: readonly string[];
  assignments: readonly { userId: string; points: number }[];
}

/**
 * Each person's carry-over: what they were handed in recent weeks minus their
 * fair share of each of those weeks. Someone who joins mid-way starts at
 * zero, rather than owing a month of Johhs they were never there for.
 */
export function carryOver(
  weeks: readonly PastWeek[],
  currentMemberIds: readonly string[],
): RotaMember[] {
  const carry = new Map(currentMemberIds.map((id) => [id, 0]));
  for (const week of weeks) {
    if (week.memberIds.length === 0) continue;
    const total = week.assignments.reduce((sum, a) => sum + a.points, 0);
    const share = total / week.memberIds.length;
    const got = new Map<string, number>();
    for (const a of week.assignments) got.set(a.userId, (got.get(a.userId) ?? 0) + a.points);
    for (const id of week.memberIds) {
      if (!carry.has(id)) continue;
      carry.set(id, carry.get(id)! + (got.get(id) ?? 0) - share);
    }
  }
  return currentMemberIds.map((id) => ({ userId: id, carry: carry.get(id)! }));
}
