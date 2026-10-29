/**
 * The track record: who does their Johns, week by week, and where each
 * person's points come from. Opened from Week.
 *
 * The grid has one square per week per person (on Week, one per John that
 * week), coloured by the worst thing in it: missed, then late; then covering
 * for someone, a good thing worth seeing; then all on time. A week with
 * nothing handed to someone is away if they were, blank if not.
 *
 * The breakdown adds up one person's span the way the deal does
 * (deal.ts carryOver, creditedTo): their share comes off, then each John
 * counts for whoever did it. A miss counts for nobody, a cover for the
 * coverer, a skip or an open John for its holder.
 */
import { tz } from "@date-fns/tz";
import { format } from "date-fns";

import { awayDays, type AwayPeriod } from "./away";
import { RECORD_COPY } from "./copy";
import { creditedTo } from "./deal";
import { dayLabel, monthLabel, weekRange } from "./format";
import { localDate, monthOf } from "./week";

export const RECORD_SPANS = ["week", "month", "year", "all"] as const;
export type RecordSpan = (typeof RECORD_SPANS)[number];

/** A span from a link's `?span=`, or this month. */
export function readSpan(param: unknown): RecordSpan {
  return (RECORD_SPANS as readonly unknown[]).includes(param) ? (param as RecordSpan) : "month";
}

/** A square's colour, by the worst thing in it. */
export type RecordMark = "missed" | "late" | "covered" | "clean" | "skipped" | "open" | "away" | "none";

export interface RecordWeek {
  id: string;
  starts_on: string;
  starts_at: string;
  ends_at: string;
}

export interface RecordJohn {
  id: string;
  week_id: string;
  user_id: string;
  name: string;
  points: number;
  due_at: string;
  done_at: string | null;
  outcome: string | null;
  excused: boolean;
  covered_by: string | null;
}

export interface RecordInput {
  weeks: readonly RecordWeek[];
  shares: readonly { week_id: string; user_id: string; share: number | string }[];
  johns: readonly RecordJohn[];
  away: readonly AwayPeriod[];
  memberIds: readonly string[];
  now: Date;
  zone: string;
}

/** How one John went for whoever held it: a cover by someone else is the holder's miss. */
export type HeldMark = "clean" | "late" | "missed" | "skipped" | "open";

export function heldMark(j: Pick<RecordJohn, "outcome" | "excused" | "covered_by" | "done_at">): HeldMark {
  if (j.outcome === "missed" || j.outcome === "covered" || j.covered_by) return "missed";
  if (j.outcome === "late") return "late";
  if (j.outcome === "excused" || j.excused) return "skipped";
  if (j.outcome === "done") return "clean";
  return "open";
}

const WORST: readonly RecordMark[] = ["missed", "late", "covered", "clean", "skipped", "open"];

export interface RecordCell {
  key: string;
  mark: RecordMark;
}

export interface RecordCounts {
  onTime: number;
  late: number;
  missed: number;
  skipped: number;
  /** Housemates' Johns they covered. */
  covered: number;
}

export interface RecordRow {
  userId: string;
  cells: RecordCell[];
  counts: RecordCounts;
  /** Of their settled Johns (skips aside), how many were on time, 0 to 100; null with none settled. */
  onTimePct: number | null;
}

export interface TrackRecord {
  span: RecordSpan;
  /** "19–25 Oct", "October 2026", "2026 · 44 weeks", "Since 6 Oct 2025 · 55 weeks". */
  range: string;
  /** The weeks in the span, earliest first. */
  weeks: RecordWeek[];
  /** Best on-time record first; nobody settled yet last. */
  rows: RecordRow[];
}

/** The weeks a span covers, earliest first: this week, this month's, this year's, or all of them. */
export function spanWeeks(weeks: readonly RecordWeek[], span: RecordSpan, now: Date, zone: string): RecordWeek[] {
  const sorted = [...weeks].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const started = sorted.filter((w) => new Date(w.starts_at).getTime() <= now.getTime());
  if (span === "all") return started;
  if (span === "week") return started.slice(-1);
  const month = monthOf(now, zone);
  if (span === "month") return started.filter((w) => monthOf(new Date(w.starts_at), zone) === month);
  return started.filter((w) => w.starts_on.slice(0, 4) === month.slice(0, 4));
}

function spanRange(span: RecordSpan, weeks: readonly RecordWeek[], now: Date, zone: string): string {
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  if (!first || !last) return RECORD_COPY.nothingYet;
  if (span === "week") return weekRange(new Date(first.starts_at), new Date(first.ends_at), zone);
  if (span === "month") return monthLabel(monthOf(now, zone));
  if (span === "year") return RECORD_COPY.yearRange(monthOf(now, zone).slice(0, 4), weeks.length);
  return RECORD_COPY.allRange(format(new Date(first.starts_at), "d MMM yyyy", { in: tz(zone) }), weeks.length);
}

function worst(marks: readonly RecordMark[]): RecordMark {
  for (const m of WORST) if (marks.includes(m)) return m;
  return "none";
}

/** Someone's mark for a week: the worst of their Johns, covering for someone, or away when they had none. */
function weekMark(input: RecordInput, week: RecordWeek, userId: string): RecordMark {
  const theirs = input.johns.filter((j) => j.week_id === week.id && j.user_id === userId).map((j) => heldMark(j) as RecordMark);
  const covered = input.johns.some((j) => j.week_id === week.id && j.covered_by === userId && j.user_id !== userId);
  const marks: RecordMark[] = covered ? [...theirs, "covered"] : theirs;
  if (marks.length > 0) return worst(marks);
  const lastDay = localDate(new Date(new Date(week.ends_at).getTime() - 1), input.zone);
  return awayDays(input.away, userId, week.starts_on, lastDay).length > 0 ? "away" : "none";
}

export function trackRecord(input: RecordInput, span: RecordSpan): TrackRecord {
  const weeks = spanWeeks(input.weeks, span, input.now, input.zone);
  const ids = new Set(weeks.map((w) => w.id));
  const johns = input.johns.filter((j) => ids.has(j.week_id));

  const rows = input.memberIds.map((userId): RecordRow => {
    const held = johns.filter((j) => j.user_id === userId).sort((a, b) => a.due_at.localeCompare(b.due_at));
    const counts: RecordCounts = { onTime: 0, late: 0, missed: 0, skipped: 0, covered: 0 };
    for (const j of held) {
      const m = heldMark(j);
      if (m === "clean") counts.onTime += 1;
      else if (m === "late") counts.late += 1;
      else if (m === "missed") counts.missed += 1;
      else if (m === "skipped") counts.skipped += 1;
    }
    const coveredFor = johns.filter((j) => j.covered_by === userId && j.user_id !== userId);
    counts.covered = coveredFor.length;
    const settled = counts.onTime + counts.late + counts.missed;

    const cells: RecordCell[] =
      span === "week"
        ? [
            ...held.map((j) => ({ key: j.id, mark: heldMark(j) as RecordMark })),
            ...coveredFor.map((j) => ({ key: `covered:${j.id}`, mark: "covered" as const })),
          ]
        : weeks.map((w) => ({ key: w.id, mark: weekMark(input, w, userId) }));

    return { userId, cells, counts, onTimePct: settled > 0 ? Math.round((counts.onTime / settled) * 100) : null };
  });
  rows.sort((a, b) => (b.onTimePct ?? -1) - (a.onTimePct ?? -1));
  return { span, range: spanRange(span, weeks, input.now, input.zone), weeks, rows };
}

// --- One person's breakdown ---------------------------------------------------------------

export interface BreakdownJohn {
  id: string;
  name: string;
  /** "Tue 6 Oct". */
  day: string;
  points: number;
  /** "Ana covered it", "for Ben", "5h late"; null when there's nothing to add. */
  note: string | null;
}

export type BreakdownKey = "share" | "onTime" | "late" | "skipped" | "open" | "missed" | "covered";

export interface BreakdownLine {
  key: BreakdownKey;
  /** What it adds to their balance (the share is below zero; a miss adds nothing). */
  points: number;
  johns: BreakdownJohn[];
}

export interface Breakdown {
  userId: string;
  range: string;
  /** How many weeks the span holds. */
  weeks: number;
  /** Only the lines with something in them, in the order they add up. */
  lines: BreakdownLine[];
  /** The lines added up: work done minus share, over the span. */
  total: number;
}

const BREAKDOWN_ORDER: readonly BreakdownKey[] = ["share", "onTime", "late", "skipped", "open", "missed", "covered"];

/** A line's points with its sign: "+10", "−15", "0"; to a tenth, since shares come in thirds. */
export function signedPoints(points: number): string {
  const rounded = Math.round(points * 10) / 10;
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${rounded}` : `−${Math.abs(rounded)}`;
}

function round(points: number): number {
  return Math.round(points * 100) / 100;
}

export function recordBreakdown(
  input: RecordInput,
  span: RecordSpan,
  userId: string,
  nameOf: (userId: string) => string,
): Breakdown {
  const weeks = spanWeeks(input.weeks, span, input.now, input.zone);
  const ids = new Set(weeks.map((w) => w.id));
  const johns = input.johns.filter((j) => ids.has(j.week_id)).sort((a, b) => a.due_at.localeCompare(b.due_at));
  const share = input.shares
    .filter((s) => ids.has(s.week_id) && s.user_id === userId)
    .reduce((sum, s) => sum + Number(s.share), 0);

  const lines = new Map<BreakdownKey, BreakdownLine>(BREAKDOWN_ORDER.map((key) => [key, { key, points: 0, johns: [] }]));
  lines.get("share")!.points = -round(share);
  const add = (key: BreakdownKey, j: RecordJohn, note: string | null) => {
    const line = lines.get(key)!;
    // What it adds is what the deal credits them with: nothing for a miss.
    if (creditedTo({ userId: j.user_id, points: j.points, outcome: j.outcome, coveredBy: j.covered_by }) === userId) {
      line.points += j.points;
    }
    line.johns.push({ id: j.id, name: j.name, day: dayLabel(new Date(j.due_at), input.zone), points: j.points, note });
  };

  for (const j of johns) {
    if (j.user_id === userId) {
      const m = heldMark(j);
      if (m === "missed") add("missed", j, j.covered_by ? RECORD_COPY.coveredIt(nameOf(j.covered_by)) : null);
      else if (m === "clean") add("onTime", j, null);
      else if (m === "late") add("late", j, null);
      else if (m === "skipped") add("skipped", j, null);
      else add("open", j, null);
    } else if (j.covered_by === userId) {
      add("covered", j, RECORD_COPY.coveredFor(nameOf(j.user_id)));
    }
  }

  const kept = BREAKDOWN_ORDER.map((key) => lines.get(key)!).filter((l) => l.key === "share" || l.johns.length > 0);
  return {
    userId,
    range: spanRange(span, weeks, input.now, input.zone),
    weeks: weeks.length,
    lines: kept,
    total: round(kept.reduce((sum, l) => sum + l.points, 0)),
  };
}
