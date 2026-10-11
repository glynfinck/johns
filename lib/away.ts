import { addDaysTo } from "@/lib/week";

/**
 * Time away, as the house's local calendar dates. A period runs from its
 * first away day to its last, inclusive; dates are `yyyy-MM-dd`, which
 * compare correctly as strings. Pure, and every function takes "today".
 *
 * The rules that make time away fair live elsewhere: lib/deal.ts never hands
 * someone a John due on an away day but keeps counting their share, and
 * set_away (supabase/migrations) makes the Johns they already have due
 * before they go.
 */

export interface AwayPeriod {
  id: string;
  userId: string;
  startsOn: string;
  endsOn: string;
  note: string | null;
}

/** Whether someone is away on a local date. */
export function awayOn(periods: readonly AwayPeriod[], userId: string, date: string): boolean {
  return periods.some((p) => p.userId === userId && p.startsOn <= date && date <= p.endsOn);
}

/** The local dates from `from` to `to`, inclusive. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysTo(d, 1)) out.push(d);
  return out;
}

/** The days of a span someone is away, in order. */
export function awayDays(periods: readonly AwayPeriod[], userId: string, from: string, to: string): string[] {
  return datesBetween(from, to).filter((d) => awayOn(periods, userId, d));
}

/** Someone's period that covers today, or else their next one. */
export function currentOrNext(periods: readonly AwayPeriod[], userId: string, today: string): AwayPeriod | null {
  return (
    periods
      .filter((p) => p.userId === userId && p.endsOn >= today)
      .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0] ?? null
  );
}

/** What a period still covers from today: all of it if it hasn't started, the rest if it has. */
export function remaining(period: AwayPeriod, today: string): { from: string; to: string } | null {
  if (period.endsOn < today) return null;
  return { from: period.startsOn > today ? period.startsOn : today, to: period.endsOn };
}
