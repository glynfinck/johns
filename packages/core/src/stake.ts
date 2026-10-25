import type { HouseRules, Outcome } from "./domain";

/**
 * The Stake.
 *
 * Everyone stakes the same amount each month. Finishing your Johns keeps it;
 * a late John forfeits a little, a missed one more, and nobody can lose more
 * than their stake in a month. Whatever is forfeited is shared equally among
 * the rest of the house.
 *
 * Only the differences ever change hands, so the app never asks anyone to pay
 * the stake in up front. It keeps an append-only ledger instead, in minor
 * units (pence, cents) and from each person's side: negative means they owe,
 * positive means they are owed. A balance is a sum of entries, never a stored
 * number, and a month's entries always sum to zero.
 *
 *   forfeit     written as each late or missed John is settled (negative)
 *   cap_refund  at month end, gives back anything forfeited beyond the stake
 *   share       at month end, each person's cut of everyone else's forfeits
 *   payment     when a payee confirms money arrived: +payer, −payee
 */

export type LedgerKind = "forfeit" | "cap_refund" | "share" | "payment";

export interface LedgerEntry {
  userId: string;
  kind: LedgerKind;
  amount: number;
}

/** What one settled John costs. */
export function forfeitFor(
  outcome: Outcome,
  rules: Pick<HouseRules, "lateForfeitMinor" | "missedForfeitMinor">,
): number {
  if (outcome === "late") return rules.lateForfeitMinor;
  if (outcome === "missed") return rules.missedForfeitMinor;
  return 0;
}

export interface MonthSettlement {
  /** Each person's forfeits after the cap, as a positive number. */
  forfeited: Record<string, number>;
  /** Each person's cut of the others' forfeits. */
  received: Record<string, number>;
  /** The entries that close the month (cap refunds and shares). */
  entries: LedgerEntry[];
}

/**
 * Close a month. `memberIds` is everyone sharing in it, in a stable order
 * (join order): the order decides who gets the odd penny when a forfeit does
 * not split evenly, so it must not change between runs.
 */
export function settleMonth(
  memberIds: readonly string[],
  stakeMinor: number,
  forfeits: readonly { userId: string; amount: number }[],
): MonthSettlement {
  const ids = [...memberIds];
  for (const f of forfeits) if (!ids.includes(f.userId)) ids.push(f.userId);

  const raw = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const f of forfeits) raw.set(f.userId, raw.get(f.userId)! + f.amount);

  const forfeited: Record<string, number> = {};
  const received: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const entries: LedgerEntry[] = [];

  for (const id of ids) {
    const total = raw.get(id)!;
    // A house of one has nobody to pay; everything comes back.
    const cap = ids.length < 2 ? 0 : Math.max(0, stakeMinor);
    const kept = Math.min(total, cap);
    forfeited[id] = kept;
    if (total > kept) entries.push({ userId: id, kind: "cap_refund", amount: total - kept });
  }

  for (const payer of ids) {
    const amount = forfeited[payer];
    if (amount === 0) continue;
    const others = ids.filter((id) => id !== payer);
    const base = Math.floor(amount / others.length);
    let remainder = amount - base * others.length;
    for (const id of others) {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      received[id] += base + extra;
    }
  }

  for (const id of ids) {
    if (received[id] > 0) entries.push({ userId: id, kind: "share", amount: received[id] });
  }

  return { forfeited, received, entries };
}

/** Sum entries into balances. */
export function balances(entries: readonly { userId: string; amount: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entries) out.set(e.userId, (out.get(e.userId) ?? 0) + e.amount);
  return out;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/**
 * Who pays whom to clear the balances, in as few transfers as the greedy
 * rule finds: the biggest debt pays the biggest credit until one is cleared.
 * At most one transfer fewer than the number of people with a balance.
 */
export function settleUp(balance: ReadonlyMap<string, number>): Transfer[] {
  const debtors = [...balance]
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, left: -v }))
    .sort((a, b) => b.left - a.left || a.id.localeCompare(b.id));
  const creditors = [...balance]
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, left: v }))
    .sort((a, b) => b.left - a.left || a.id.localeCompare(b.id));

  const out: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].left, creditors[c].left);
    if (amount > 0) out.push({ from: debtors[d].id, to: creditors[c].id, amount });
    debtors[d].left -= amount;
    creditors[c].left -= amount;
    if (debtors[d].left === 0) d += 1;
    if (creditors[c].left === 0) c += 1;
  }
  return out;
}
