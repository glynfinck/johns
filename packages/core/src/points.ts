import type { LiveStatus } from "./outcome";

/**
 * The Table: effort points earned, not points handed out.
 *
 * A John done on time earns its points, a late one earns half (rounded down),
 * and a missed or excused one earns nothing. A tick still inside its dispute
 * window counts as done, provisionally, so the live table moves when you
 * tick rather than a day later.
 */
export function pointsEarned(status: LiveStatus, points: number): number {
  switch (status) {
    case "done":
    case "checking":
    case "disputed":
      return points;
    case "late":
      return Math.floor(points / 2);
    default:
      return 0;
  }
}

export interface TableRow {
  userId: string;
  points: number;
  done: number;
  late: number;
  missed: number;
  /** Housemates' Johns this person covered. */
  covered: number;
  rank: number;
}

export interface TableInput {
  userId: string;
  points: number;
  status: LiveStatus;
  /** Who covered it, if a housemate did. */
  coveredBy?: string | null;
}

/**
 * Standings, highest first. Ties share a rank (1, 2, 2, 4); within one,
 * fewer missed, then fewer late, come first.
 *
 * A cover counts for the coverer, full points, from the moment it's made
 * (like a tick being checked); once it stands, the assignee has a miss.
 */
export function standings(rows: readonly TableInput[], memberIds: readonly string[]): TableRow[] {
  const by = new Map<string, TableRow>(
    memberIds.map((id) => [id, { userId: id, points: 0, done: 0, late: 0, missed: 0, covered: 0, rank: 0 }]),
  );
  for (const r of rows) {
    if (r.coveredBy && (r.status === "covered" || r.status === "disputed")) {
      const coverer = by.get(r.coveredBy);
      if (coverer) {
        coverer.points += r.points;
        coverer.covered += 1;
      }
      if (r.status === "covered") {
        const assignee = by.get(r.userId);
        if (assignee) assignee.missed += 1;
      }
      continue;
    }
    const row = by.get(r.userId);
    if (!row) continue;
    row.points += pointsEarned(r.status, r.points);
    if (r.status === "done" || r.status === "checking" || r.status === "disputed") row.done += 1;
    if (r.status === "late") row.late += 1;
    if (r.status === "missed") row.missed += 1;
  }
  const sorted = [...by.values()].sort(
    (a, b) => b.points - a.points || a.missed - b.missed || a.late - b.late || a.userId.localeCompare(b.userId),
  );
  sorted.forEach((row, i) => {
    row.rank = i > 0 && sorted[i - 1].points === row.points ? sorted[i - 1].rank : i + 1;
  });
  return sorted;
}

/**
 * Who topped a closed week: everyone tied for the most points, as long as
 * somebody scored. They each earn a swap token (see streak.ts).
 */
export function weekWinners(rows: readonly TableRow[]): string[] {
  const top = rows.reduce((max, r) => Math.max(max, r.points), 0);
  if (top === 0) return [];
  return rows.filter((r) => r.points === top).map((r) => r.userId);
}
