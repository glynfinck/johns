import { tz } from "@date-fns/tz";
import { differenceInCalendarDays, format } from "date-fns";

import type { LiveStatus } from "@/lib/outcome";

/**
 * How times read on screen, in the house's own time zone. Pure: the caller
 * passes `now`, so "tomorrow" means the same thing in a test as on a phone.
 */

/** "Today 21:00", "Tomorrow 07:30", "Thu 21:00", "Mon 6 Oct". */
export function dueLabel(due: Date, now: Date, zone: string): string {
  const inZone = tz(zone);
  const days = differenceInCalendarDays(due, now, { in: inZone });
  const time = format(due, "HH:mm", { in: inZone });
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  if (days === -1) return `Yesterday ${time}`;
  if (days > 1 && days < 7) return `${format(due, "EEE", { in: inZone })} ${time}`;
  return format(due, "EEE d MMM", { in: inZone });
}

/** "in 3h", "in 2 days", "3h ago" — for the line under a John. */
export function relative(target: Date, now: Date): string {
  const ms = target.getTime() - now.getTime();
  const abs = Math.abs(ms);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const body =
    minutes < 60 ? `${Math.max(1, minutes)} min` : hours < 36 ? `${hours}h` : `${days} ${days === 1 ? "day" : "days"}`;
  return ms >= 0 ? `in ${body}` : `${body} ago`;
}

/** "6–12 Oct", "28 Sep – 4 Oct". The end is the last day, not the instant the week ends. */
export function weekRange(startsAt: Date, endsAt: Date, zone: string): string {
  const inZone = tz(zone);
  const last = new Date(endsAt.getTime() - 1);
  const sameMonth = format(startsAt, "MM", { in: inZone }) === format(last, "MM", { in: inZone });
  return sameMonth
    ? `${format(startsAt, "d", { in: inZone })}–${format(last, "d MMM", { in: inZone })}`
    : `${format(startsAt, "d MMM", { in: inZone })} – ${format(last, "d MMM", { in: inZone })}`;
}

/** "October 2026" from "2026-10". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return format(new Date(Date.UTC(y, m - 1, 15)), "MMMM yyyy");
}

export const STATUS_LABEL: Record<LiveStatus, string> = {
  upcoming: "Upcoming",
  "due-soon": "Due soon",
  overdue: "Overdue",
  checking: "Done, being checked",
  disputed: "Disputed",
  done: "Done",
  late: "Done late",
  missed: "Missed",
  excused: "Excused",
};

/** First letters of up to two words: "Priya Shah" → "PS". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/** "Priya" from "Priya Shah": housemates use first names. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
