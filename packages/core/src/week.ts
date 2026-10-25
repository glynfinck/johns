import { tz, TZDate } from "@date-fns/tz";
import { addDays, addMonths, addWeeks, format, set, startOfMonth, startOfWeek } from "date-fns";

import type { IsoDow } from "./domain";

/**
 * Week and month edges in a house's own time zone.
 *
 * Every function takes the instant it reasons about as an argument: nothing
 * here reads the clock, so the deal, the outcome rules and the Stake can all
 * be unit-tested at any moment of any week, DST changes included.
 */

export interface WeekWindow {
  /** The local date the week starts on, `yyyy-MM-dd`. The week's identity. */
  startsOn: string;
  startsAt: Date;
  endsAt: Date;
}

/** date-fns counts Sunday as 0; ISO counts it as 7. */
function jsDay(dow: IsoDow): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return (dow % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/** The house week that contains `now`. */
export function weekWindow(now: Date, zone: string, weekStarts: IsoDow): WeekWindow {
  const inZone = tz(zone);
  const start = startOfWeek(now, { weekStartsOn: jsDay(weekStarts), in: inZone });
  const end = addWeeks(start, 1, { in: inZone });
  return {
    startsOn: format(start, "yyyy-MM-dd", { in: inZone }),
    startsAt: new Date(start.getTime()),
    endsAt: new Date(end.getTime()),
  };
}

/** The week after `week`, computed from its local start date. */
export function nextWeek(week: WeekWindow, zone: string, weekStarts: IsoDow): WeekWindow {
  // A day past the end is always inside the next week, DST or not.
  return weekWindow(addDays(new TZDate(week.endsAt, zone), 1), zone, weekStarts);
}

/**
 * When a John is due inside a week: its day of the week at its local time.
 * `dueTime` is `HH:mm`. A due day before the week's first day falls in the
 * following calendar week, so every John is due inside the week it belongs to.
 */
export function dueAt(
  week: WeekWindow,
  zone: string,
  weekStarts: IsoDow,
  dueDow: IsoDow,
  dueTime: string,
): Date {
  const [hours, minutes] = dueTime.split(":").map(Number);
  const offset = (dueDow - weekStarts + 7) % 7;
  const day = addDays(new TZDate(week.startsAt, zone), offset);
  const due = set(day, { hours, minutes, seconds: 0, milliseconds: 0 });
  return new Date(due.getTime());
}

/**
 * A week dealt part-way through (the first week, or a re-deal after someone
 * joins) must not hand anyone a John that is already overdue. Anything due
 * within a day of the deal moves to a day after it, or to the last minute of
 * the week if that comes first.
 */
export function graceDue(due: Date, dealtAt: Date, weekEndsAt: Date): Date {
  const floor = Math.min(dealtAt.getTime() + 86_400_000, weekEndsAt.getTime() - 60_000);
  return new Date(Math.max(due.getTime(), floor));
}

/**
 * A stable counter of weeks, so "every two weeks" means the same thing on
 * every machine. Counts whole weeks from a fixed Monday by calendar date, which
 * works for any week-start day because consecutive weeks are 7 dates apart.
 */
export function weekIndex(startsOn: string): number {
  const [y, m, d] = startsOn.split("-").map(Number);
  const days = (Date.UTC(y, m - 1, d) - Date.UTC(1970, 0, 5)) / 86_400_000;
  return Math.floor(days / 7);
}

/** Whether a John repeating every `everyWeeks`, first due in `anchorIndex`, is due this week. */
export function isDueInWeek(everyWeeks: number, anchorIndex: number, index: number): boolean {
  if (everyWeeks <= 1) return true;
  const offset = (((index - anchorIndex) % everyWeeks) + everyWeeks) % everyWeeks;
  return offset === 0;
}

/** The calendar month an instant falls in, locally, as `yyyy-MM`. */
export function monthOf(at: Date, zone: string): string {
  return format(at, "yyyy-MM", { in: tz(zone) });
}

export interface MonthWindow {
  month: string;
  startsAt: Date;
  endsAt: Date;
}

/** The local edges of a `yyyy-MM` month. */
export function monthWindow(month: string, zone: string): MonthWindow {
  const [y, m] = month.split("-").map(Number);
  const start = startOfMonth(new TZDate(y, m - 1, 1, 0, 0, 0, zone));
  const end = addMonths(start, 1);
  return { month, startsAt: new Date(start.getTime()), endsAt: new Date(end.getTime()) };
}

/** The month before a `yyyy-MM` month. */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** The local calendar date an instant falls on, as `yyyy-MM-dd`. */
export function localDate(at: Date, zone: string): string {
  return format(at, "yyyy-MM-dd", { in: tz(zone) });
}

/** A `yyyy-MM-dd` date moved by whole days. Calendar arithmetic, so DST never shifts it. */
export function addDaysTo(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const moved = new Date(Date.UTC(y, m - 1, d + days));
  return moved.toISOString().slice(0, 10);
}
