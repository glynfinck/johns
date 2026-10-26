import { tz } from "@date-fns/tz";
import { differenceInCalendarDays, format } from "date-fns";

import { currentOrNext, type AwayPeriod } from "./away";
import { isOpen, TODAY_ORDER, type BoardItem, type DisputeView, type WeekBoard } from "./board";
import { FOCUS_SHELL_COPY, JOHN_SHEET_COPY, NEXT_UP_COPY } from "./copy";
import { CATEGORY_LABEL, type Category, type Currency, type HouseRules } from "./domain";
import { dateRange, dueLabel, firstName, pointsLabel, relative } from "./format";
import { formatMoney } from "./money";
import type { LiveStatus } from "./outcome";
import type { TableRow } from "./points";
import type { StakeView } from "./stake";
import { addDaysTo, monthOf } from "./week";

// Today as Focus shows it, and the John sheet: which John is Next up and
// what the rest of your week holds, the words in their meta lines (what
// lateness costs, from the house's rules and what's left of your stake),
// the standing line, time away, the setup checklist, and what the sheet
// offers for a John and whoever is looking. Pure: every function that
// reads the clock takes `now`, and times are in the house's zone
// (`rules.timezone`).

/** Someone in the house, as far as these words need them. */
interface Person {
  userId: string;
  name: string;
}

/** A John's kind in words; anything unknown is "Everything else". */
function kindOf(category: string): string {
  return CATEGORY_LABEL[category as Category] ?? CATEGORY_LABEL.other;
}

/** A John's kind, short, for a row's meta line beside its trailing item: "Bins", "Floors". */
function shortKindOf(category: string): string {
  return NEXT_UP_COPY.kinds[category] ?? NEXT_UP_COPY.kinds.other;
}

/** "today 21:00", "tomorrow 07:30", "Thu 21:00": a due label mid-sentence. */
function when(at: Date, now: Date, zone: string): string {
  return dueLabel(at, now, zone).replace(/^(Today|Tomorrow|Yesterday)/, (w) => w.toLowerCase());
}

/** A first name to start a sentence with: "Priya", or "A former housemate" for someone who has left. */
function firstNameIn(people: readonly Person[], userId: string | null): string {
  const person = people.find((p) => p.userId === userId);
  return person ? firstName(person.name) : FOCUS_SHELL_COPY.formerHousemate;
}

/** A first name mid-sentence: "Priya", or "a former housemate". */
function called(people: readonly Person[], userId: string | null): string {
  const person = people.find((p) => p.userId === userId);
  return person ? firstName(person.name) : NEXT_UP_COPY.someoneGone;
}

/** Settled one way or another: nothing more to do or check. */
const SETTLED: ReadonlySet<LiveStatus> = new Set<LiveStatus>(["done", "late", "excused", "missed"]);

/** Settled without a forfeit still to see: what "Done (n)" folds away. A missed John stays out, in hazard. */
const FOLDED: ReadonlySet<LiveStatus> = new Set<LiveStatus>(["done", "late", "excused"]);

function inTodayOrder(items: readonly BoardItem[]): BoardItem[] {
  return [...items].sort((a, b) => TODAY_ORDER[a.status] - TODAY_ORDER[b.status] || a.dueAt.getTime() - b.dueAt.getTime());
}

/** Your next open John: overdue first, then whatever is due soonest. Null when nothing's left to do. */
export function nextUp(mine: readonly BoardItem[]): BoardItem | null {
  return inTodayOrder(mine).find((i) => isOpen(i.status)) ?? null;
}

/**
 * The rest of your week beside the John that Next up shows (`shownId`):
 * what's still going (to do, being checked, disputed, and a missed John,
 * which keeps its hazard in view) in Today's order, and what's finished,
 * for the "Done (n)" fold.
 */
export function restOfWeek(
  mine: readonly BoardItem[],
  shownId: string | null,
): { going: BoardItem[]; finished: BoardItem[] } {
  const others = inTodayOrder(mine).filter((i) => i.id !== shownId);
  return { going: others.filter((i) => !FOLDED.has(i.status)), finished: others.filter((i) => FOLDED.has(i.status)) };
}

/**
 * The last day of the time away you're on today, or null when you're home.
 * Trips that run on from each other count as one.
 */
export function awayTodayUntil(periods: readonly AwayPeriod[], userId: string, today: string): string | null {
  const mine = periods.filter((p) => p.userId === userId).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const now = mine.find((p) => p.startsOn <= today && today <= p.endsOn);
  if (!now) return null;
  let until = now.endsOn;
  for (const p of mine) if (p.startsOn <= addDaysTo(until, 1) && p.endsOn > until) until = p.endsOn;
  return until;
}

/** How far ahead Today mentions a trip of yours, as the web's banner did. */
const AWAY_NOTICE_DAYS = 14;

/**
 * Your time away as Today's line under the week says it: "You're away
 * until Fri 30 Oct" while you're gone (when the card is saying something
 * else, before the week is out), or "You're away 28–31 Oct" for a trip that
 * starts within a fortnight. Null when there's neither.
 */
export function awayLine(periods: readonly AwayPeriod[], userId: string, today: string): string | null {
  const until = awayTodayUntil(periods, userId, today);
  if (until) return NEXT_UP_COPY.away(dateRange(until, until));
  const next = currentOrNext(periods, userId, today);
  if (!next || next.startsOn > addDaysTo(today, AWAY_NOTICE_DAYS)) return null;
  return NEXT_UP_COPY.awaySoon(dateRange(next.startsOn, next.endsOn));
}

/** What takes the Next up card's place: the setup, a wait, time away, your next John, or nothing to do. */
export type NextUpState =
  /** Nothing has ever been dealt, and you're an admin: the setup checklist. */
  | { kind: "setup" }
  /** Nothing has ever been dealt, and someone else deals: who. */
  | { kind: "waiting"; admin: string }
  /** The house has started, but this week isn't out yet. */
  | { kind: "undealt" }
  /** You're away today, until this local date (the last day away). */
  | { kind: "away"; until: string }
  | { kind: "john"; item: BoardItem }
  /** Nothing of yours left to do; new Johns come when the week turns over, at `until`. */
  | { kind: "clear"; until: Date; nothingYours: boolean };

/** Which of Today's card states shows, from the week, your Johns, who deals and your time away. */
export function nextUpState(input: {
  board: WeekBoard;
  mine: readonly BoardItem[];
  userId: string;
  /** Who lives here, in the order they joined: the first admin is who deals. */
  members: readonly (Person & { role: string })[];
  /** From awayTodayUntil: null at home, or while time away isn't read yet. */
  awayUntil: string | null;
}): NextUpState {
  const { board, mine, members } = input;
  if (board.notStarted) {
    if (members.some((m) => m.userId === input.userId && m.role === "admin")) return { kind: "setup" };
    const admin = members.find((m) => m.role === "admin");
    return { kind: "waiting", admin: admin ? firstName(admin.name) : NEXT_UP_COPY.anAdmin };
  }
  if (!board.week) return { kind: "undealt" };
  if (input.awayUntil) return { kind: "away", until: input.awayUntil };
  const item = nextUp(mine);
  if (item) return { kind: "john", item };
  return { kind: "clear", until: board.week.endsAt, nothingYours: mine.length === 0 };
}

/** "You're clear until Wed": the day the week turns over, in the house's zone. */
export function clearUntil(until: Date, zone: string): string {
  return NEXT_UP_COPY.clear(format(until, "EEE", { in: tz(zone) }));
}

/** When an overdue John fell due: its time today, its day this week, its date before that. */
function since(due: Date, now: Date, zone: string): string {
  const inZone = tz(zone);
  const days = differenceInCalendarDays(now, due, { in: inZone });
  if (days <= 0) return format(due, "HH:mm", { in: inZone });
  if (days < 7) return format(due, "EEE", { in: inZone });
  return format(due, "EEE d MMM", { in: inZone });
}

/**
 * How much more lateness can cost you in a month: forfeits are capped at
 * the stake, so it's the stake less what you've forfeited in it so far
 * (from the Stake's projection), and nothing in a house of one, where
 * every forfeit comes back. Null when it isn't known: the Stake not read
 * yet, or a John due in another month than the one it projects.
 */
export function forfeitRoom(
  stake: Pick<StakeView, "month" | "stakeMinor" | "projection"> | null,
  userId: string,
  month: string,
): number | null {
  if (stake === null || stake.month !== month) return null;
  if (stake.projection.length < 2) return 0;
  const forfeited = stake.projection.find((p) => p.userId === userId)?.forfeitedRaw ?? 0;
  return Math.max(0, stake.stakeMinor - forfeited);
}

/** The late and missed forfeits as they'd land on you, each capped at `room` when it's known; null when free. */
function forfeits(rules: HouseRules, room: number | null): { late: string | null; missed: string | null } {
  const money = (amount: number) => {
    const capped = Math.max(0, room === null ? amount : Math.min(amount, room));
    return capped > 0 ? formatMoney(capped, rules.currency) : null;
  };
  return { late: money(rules.lateForfeitMinor), missed: money(rules.missedForfeitMinor) };
}

/** What an overdue John costs: "£1 now, £3 if missed", or less when a forfeit is zero. */
function overdueCost(rules: HouseRules, room: number | null): string | null {
  const { late, missed } = forfeits(rules, room);
  if (late && missed) return NEXT_UP_COPY.nowOrMissed(late, missed);
  if (late) return NEXT_UP_COPY.now(late);
  if (missed) return NEXT_UP_COPY.ifMissed(missed);
  return null;
}

/** The meta under Next up's John. */
export interface NextUpMeta {
  /** The kind, after its lid dot. */
  kind: string;
  /** While it's to do: when it's due and what being late costs. Null once overdue. */
  due: string | null;
  /** Overdue: since when (hazard words after a hazard sign, on a line of their own), and what it costs. */
  overdue: { since: string; cost: string | null } | null;
}

/**
 * "Bathroom" and "due today 21:00 · £1 if late"; overdue, "Kitchen" and
 * "Overdue since Tue" with "£1 now, £3 if missed". `room` caps the costs
 * at what's left of your stake (forfeitRoom).
 */
export function nextUpMeta(item: BoardItem, rules: HouseRules, now: Date, room: number | null = null): NextUpMeta {
  const zone = rules.timezone;
  const kind = kindOf(item.category);
  if (item.status === "overdue") {
    return {
      kind,
      due: null,
      overdue: { since: NEXT_UP_COPY.overdueSince(since(item.dueAt, now, zone)), cost: overdueCost(rules, room) },
    };
  }
  const due = NEXT_UP_COPY.due(when(item.dueAt, now, zone)) + (item.movedFrom ? `, ${NEXT_UP_COPY.beforeYouGo}` : "");
  const { late, missed } = forfeits(rules, room);
  const cost = late ? NEXT_UP_COPY.ifLate(late) : missed ? NEXT_UP_COPY.ifMissed(missed) : null;
  return { kind, due: [due, cost].filter(Boolean).join(" · "), overdue: null };
}

/** One of your Johns as a row on Today: what it shows and what it does. */
export interface MyJohnRow {
  /** The meta line: its kind, short, then where it has got to. */
  meta: string;
  /** Whether the lid dot leads the meta line (a dispute's line says who raised it instead). */
  lid: boolean;
  /** The leading slot: a circle that ticks it (still to do), the circle's other faces, or the immunity shield. */
  circle: "tick" | "checking" | "done" | "disputed" | "open" | "excused";
  /** What the circle says: the move for a circle that ticks, otherwise where the John is. */
  circleLabel: string;
  /** The one trailing item: Undo (your tick being checked), the points, the status mark, or nothing. */
  trailing: "undo" | "points" | "status" | null;
  /** The 4pt hazard edge of an overdue or missed John. */
  hazardEdge: boolean;
}

/**
 * A row in the rest of your week, by where the John has got to. Its meta
 * line never repeats what the trailing item says, so the useful part fits
 * beside it: "Kitchen · today 21:00", "Bins · stands in 21h" (beside Undo),
 * "Disputed by Megan · 17h left", "Floors · done Wed 21:00" (beside its
 * points), "Other · was due Tue" (beside the Overdue mark).
 */
export function myJohnRow(item: BoardItem, people: readonly Person[], rules: HouseRules, now: Date): MyJohnRow {
  const zone = rules.timezone;
  const kind = shortKindOf(item.category);
  const line = (...parts: (string | null)[]) => [kind, ...parts].filter(Boolean).join(" · ");
  const row = (meta: string, circle: MyJohnRow["circle"], trailing: MyJohnRow["trailing"], label?: string): MyJohnRow => ({
    meta,
    lid: true,
    circle,
    circleLabel: label ?? NEXT_UP_COPY.stateLabel[circle === "tick" ? "open" : circle],
    trailing,
    hazardEdge: item.status === "overdue" || item.status === "missed",
  });
  const tick = item.needsPhoto ? NEXT_UP_COPY.tickWithPhoto(item.name) : NEXT_UP_COPY.tick(item.name);

  switch (item.status) {
    case "upcoming":
    case "due-soon": {
      const due = when(item.dueAt, now, zone) + (item.movedFrom ? `, ${NEXT_UP_COPY.beforeYouGo}` : "");
      return row(line(due), "tick", item.status === "upcoming" ? "points" : "status", tick);
    }
    case "overdue":
      return row(line(NEXT_UP_COPY.wasDue(since(item.dueAt, now, zone))), "tick", "status", tick);
    case "missed":
      return row(line(NEXT_UP_COPY.wasDue(since(item.dueAt, now, zone))), "open", "status", NEXT_UP_COPY.stateLabel.missed);
    case "checking":
      return row(
        line(
          item.standsAt === null
            ? null
            : item.standsAt.getTime() > now.getTime()
              ? JOHN_SHEET_COPY.standsIn(relative(item.standsAt, now))
              : JOHN_SHEET_COPY.standsSoon,
        ),
        "checking",
        "undo",
      );
    case "disputed": {
      if (!item.dispute) return row(kind, "disputed", "points");
      const closes = item.dispute.closesAt;
      const left =
        closes.getTime() > now.getTime() ? NEXT_UP_COPY.left(relative(closes, now).replace(/^in /, "")) : NEXT_UP_COPY.closingNow;
      return { ...row(`${JOHN_SHEET_COPY.disputedBy(called(people, item.dispute.raisedBy))} · ${left}`, "disputed", "points"), lid: false };
    }
    case "done":
      return row(line(item.doneAt ? NEXT_UP_COPY.done(when(item.doneAt, now, zone)) : null), "done", "points");
    case "late":
      return row(line(item.doneAt ? NEXT_UP_COPY.done(when(item.doneAt, now, zone)) : null), "done", "status");
    case "excused":
      return row(line(NEXT_UP_COPY.excused), "excused", null);
  }
}

/** "1st", "2nd", "3rd", "4th", "11th", "22nd". */
function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** Where you are on a table, in words: "2nd", or "Joint 2nd" on a tie. */
export function standingPlace(rank: number, joint: boolean): string {
  return joint ? NEXT_UP_COPY.joint(ordinal(rank)) : ordinal(rank);
}

/** "October" from "2026-10". */
function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return format(new Date(Date.UTC(y, m - 1, 15)), "MMMM", { in: tz("UTC") });
}

/**
 * Today's one standing line: "Joint 2nd this week · up £4.01 in October".
 * The place is from this week's Table (joint on a tie), left out while
 * nobody has scored or there's nobody to beat; the money is your net this
 * month from the Stake's projection, left out until it's read or while
 * you aren't in it. Null when neither is known.
 */
export function standingLine(input: {
  table: readonly TableRow[];
  userId: string;
  /** The Stake, or null until it's read. */
  stake: Pick<StakeView, "month" | "projection"> | null;
  currency: Currency;
}): string | null {
  const { table, userId, stake, currency } = input;
  const me = table.find((r) => r.userId === userId);
  const scored = table.some((r) => r.points > 0);
  const place =
    me && table.length > 1 && scored
      ? NEXT_UP_COPY.thisWeek(standingPlace(me.rank, table.some((r) => r.userId !== userId && r.rank === me.rank)))
      : null;
  const net = stake?.projection.find((p) => p.userId === userId)?.net ?? null;
  const month = stake ? monthName(stake.month) : null;
  const money =
    net === null || month === null
      ? null
      : net > 0
        ? NEXT_UP_COPY.up(formatMoney(net, currency), month)
        : net < 0
          ? NEXT_UP_COPY.down(formatMoney(-net, currency), month)
          : NEXT_UP_COPY.square(month);
  const line = [place, money].filter(Boolean).join(" · ");
  return line ? line[0].toUpperCase() + line.slice(1) : null;
}

/** An admin's first steps, before anything is dealt: each one done or not, and whether the deal is ready. */
export interface SetupChecklist {
  /** How many Johns are on the list; null while it's being read. */
  johnCount: number | null;
  johns: boolean;
  housemates: boolean;
  /** Both of the above: the deal turns amber. */
  ready: boolean;
}

/** From the John list (null while it's being read) and how many live here. */
export function setupChecklist(list: readonly unknown[] | null, memberCount: number): SetupChecklist {
  const johnCount = list ? list.length : null;
  const johns = (johnCount ?? 0) > 0;
  const housemates = memberCount > 1;
  return { johnCount, johns, housemates, ready: johns && housemates };
}

/** "closes in 17h", or "closing now" once its time has come and the clock hasn't closed it yet. */
export function voteCloses(closesAt: Date, now: Date): string {
  return closesAt.getTime() > now.getTime() ? NEXT_UP_COPY.closes(relative(closesAt, now)) : NEXT_UP_COPY.closingNow;
}

/** Needs you's title for a dispute: "Vote on Priya’s Clean the bathroom" ("Vote on Clean the bathroom" once she's left). */
export function voteTitle(item: Pick<BoardItem, "userId" | "name">, people: readonly Person[]): string {
  const owner = people.find((p) => p.userId === item.userId);
  return NEXT_UP_COPY.voteOn(owner ? firstName(owner.name) : null, item.name);
}

/** Needs you's meta line for a dispute: "Megan says it's not done · closes in 17h". */
export function voteMeta(dispute: DisputeView, people: readonly Person[], now: Date): string {
  return `${NEXT_UP_COPY.saysNotDone(firstNameIn(people, dispute.raisedBy))} · ${voteCloses(dispute.closesAt, now)}`;
}

/** The tally, in the vote buttons' order: "1 fine · 1 not done · closes in 17h". */
export function voteTally(dispute: DisputeView, now: Date): string {
  return JOHN_SHEET_COPY.tally(dispute.reject, dispute.uphold, voteCloses(dispute.closesAt, now));
}

/** What the John sheet offers, from whose John it is and where it has got to. */
export type JohnSheetMode =
  | "yours-open"
  | "yours-checking"
  | "yours-disputed"
  | "theirs-open"
  | "theirs-checking"
  | "theirs-disputed"
  | "settled";

/** The sheet's mode for a John and whoever is looking at it. */
export function johnSheetMode(item: Pick<BoardItem, "userId" | "status">, viewerId: string): JohnSheetMode {
  if (SETTLED.has(item.status)) return "settled";
  const yours = item.userId === viewerId;
  if (item.status === "checking") return yours ? "yours-checking" : "theirs-checking";
  if (item.status === "disputed") return yours ? "yours-disputed" : "theirs-disputed";
  return yours ? "yours-open" : "theirs-open";
}

/** The sheet's first line: "Bathroom · Upstairs bathroom · 1 pt · every week" (the group and how often when known). */
export function sheetKind(item: BoardItem, everyWeeks: number | null): string {
  return [kindOf(item.category), item.groupName, pointsLabel(item.points), everyWeeks ? JOHN_SHEET_COPY.every(everyWeeks) : null]
    .filter(Boolean)
    .join(" · ");
}

/**
 * How often a John comes round, from the house's list: the one John there
 * with the same name and kind. Null when there's none (renamed since the
 * deal, or taken off the list) or more than one.
 */
export function sheetCadence(
  item: Pick<BoardItem, "name" | "category">,
  list: readonly { name: string; category: string; everyWeeks: number }[],
): number | null {
  const same = list.filter((j) => j.name === item.name && j.category === item.category);
  return same.length === 1 ? same[0].everyWeeks : null;
}

/** What lateness costs, for the sheet: "late costs £1, missed £3". Null when both are free. */
function lateCosts(rules: HouseRules, room: number | null): string | null {
  const { late, missed } = forfeits(rules, room);
  if (late && missed) return JOHN_SHEET_COPY.costs(late, missed);
  if (late) return JOHN_SHEET_COPY.lateCosts(late);
  if (missed) return JOHN_SHEET_COPY.missedCosts(missed);
  return null;
}

/**
 * The sheet's when line: "Due today 21:00 · late costs £1, missed £3" while
 * it's to do; "Overdue since Tue · £1 now, £3 if missed" once overdue and
 * "Disputed by Megan" while the house votes, each said in ink after a hazard
 * sign (`sign`), since the sheet is pavement; and just when it was due once
 * it has been ticked. `room` caps the costs at what's left of the owner's
 * stake (forfeitRoom).
 */
export function sheetWhen(
  item: BoardItem,
  people: readonly Person[],
  rules: HouseRules,
  now: Date,
  room: number | null = null,
): { sign: "overdue" | "disputed" | null; text: string } {
  const zone = rules.timezone;
  if (item.status === "overdue") {
    const text = [NEXT_UP_COPY.overdueSince(since(item.dueAt, now, zone)), overdueCost(rules, room)].filter(Boolean).join(" · ");
    return { sign: "overdue", text };
  }
  if (item.status === "disputed" && item.dispute) {
    return { sign: "disputed", text: JOHN_SHEET_COPY.disputedBy(called(people, item.dispute.raisedBy)) };
  }
  const due = JOHN_SHEET_COPY.due(when(item.dueAt, now, zone));
  if (!isOpen(item.status)) return { sign: null, text: due };
  return {
    sign: null,
    text: [item.movedFrom ? `${due}, ${NEXT_UP_COPY.beforeYouGo}` : due, lateCosts(rules, room)].filter(Boolean).join(" · "),
  };
}

/** "at 14:10" today, "yesterday at 14:10", "on Sun at 14:10" this week, "on Sun 18 Oct at 14:10" before that. */
function tickedAt(at: Date, now: Date, zone: string): string {
  const inZone = tz(zone);
  const days = differenceInCalendarDays(now, at, { in: inZone });
  const time = format(at, "HH:mm", { in: inZone });
  if (days <= 0) return JOHN_SHEET_COPY.at(time);
  if (days === 1) return JOHN_SHEET_COPY.yesterdayAt(time);
  return JOHN_SHEET_COPY.onAt(format(at, days < 7 ? "EEE" : "EEE d MMM", { in: inZone }), time);
}

/** A tick being checked: "Megan ticked this at 14:10 · stands in 21h" ("You ticked…" for yours). */
export function tickedLine(item: BoardItem, people: readonly Person[], viewerId: string, rules: HouseRules, now: Date): string {
  const who = item.userId === viewerId ? JOHN_SHEET_COPY.you : firstNameIn(people, item.userId);
  const ticked = item.doneAt ? JOHN_SHEET_COPY.ticked(who, tickedAt(item.doneAt, now, rules.timezone)) : null;
  const stands =
    item.standsAt === null
      ? null
      : item.standsAt.getTime() > now.getTime()
        ? JOHN_SHEET_COPY.standsIn(relative(item.standsAt, now))
        : JOHN_SHEET_COPY.standsSoon;
  return [ticked, stands].filter(Boolean).join(" · ");
}

/** What happened to a settled John, in a sentence: who did it and when, and what it cost. */
export function settledLine(item: BoardItem, people: readonly Person[], viewerId: string, rules: HouseRules, now: Date): string {
  const who = item.userId === viewerId ? JOHN_SHEET_COPY.you : firstNameIn(people, item.userId);
  const ticked = item.doneAt ? tickedAt(item.doneAt, now, rules.timezone) : null;
  switch (item.status) {
    case "done":
      return JOHN_SHEET_COPY.doneOnTime(who, ticked);
    case "late":
      return JOHN_SHEET_COPY.doneLate(
        who,
        ticked,
        rules.lateForfeitMinor > 0 ? formatMoney(rules.lateForfeitMinor, rules.currency) : null,
      );
    case "excused":
      return JOHN_SHEET_COPY.excused(who);
    case "missed":
      return JOHN_SHEET_COPY.missed(rules.missedForfeitMinor > 0 ? formatMoney(rules.missedForfeitMinor, rules.currency) : null);
    default:
      return "";
  }
}

/** What "If you can't" offers on one of your open Johns: the immunity you hold, and housemates' open Johns to swap for. */
export interface CantOptions {
  /** Immunity tokens held; 0 offers no skip. */
  immunity: number;
  /** Housemates' open Johns this week, soonest first, while you hold a swap token. */
  swapFor: BoardItem[];
}

/** "If you can't" for a John: null when it isn't yours and open, or you hold nothing to spend on it. */
export function cantOptions(
  item: BoardItem,
  board: WeekBoard,
  me: { userId: string; immunityTokens: number; swapTokens: number } | null,
): CantOptions | null {
  if (!me || item.userId !== me.userId || !isOpen(item.status)) return null;
  const swapFor =
    me.swapTokens > 0
      ? board.items
          .filter((i) => i.userId !== me.userId && isOpen(i.status))
          .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
      : [];
  if (me.immunityTokens <= 0 && swapFor.length === 0) return null;
  return { immunity: Math.max(0, me.immunityTokens), swapFor };
}

/** A housemate's open John as the swap lists it: "Tom · today 21:00 · 3 pts", or "Tom · was due Sun · 1 pt" overdue. */
export function swapMeta(item: BoardItem, people: readonly Person[], rules: HouseRules, now: Date): string {
  const due =
    item.status === "overdue"
      ? NEXT_UP_COPY.wasDue(since(item.dueAt, now, rules.timezone))
      : when(item.dueAt, now, rules.timezone);
  return [firstNameIn(people, item.userId), due, pointsLabel(item.points)].join(" · ");
}

/** Everything Today shows, shaped from what the screen reads. */
export interface TodayPage {
  /** What the card shows: your next John, or what takes its place. */
  state: NextUpState;
  /** The rest of your week: what's still going, and what's folded into "Done (n)". */
  going: BoardItem[];
  finished: BoardItem[];
  /** What you hold that could skip or swap Next up's John. */
  cant: { immunity: boolean; swap: boolean };
  /** How much more lateness can cost you in Next up's John's month (forfeitRoom). */
  room: number | null;
  /** Your time away, when the card isn't already saying so (awayLine). */
  away: string | null;
  /** Where you stand (standingLine), once the week is out. */
  standing: string | null;
}

/** Today's card, rows and lines from the week, you, your trips and the Stake (each null until it's read). */
export function todayPage(input: {
  board: WeekBoard;
  /** Your Johns this week (todayView's `mine`). */
  mine: readonly BoardItem[];
  userId: string;
  /** You in the house, with the tokens you hold; null if you've just left. */
  me: { userId: string; immunityTokens: number; swapTokens: number } | null;
  members: readonly (Person & { role: string })[];
  rules: HouseRules;
  /** Time away as read: today in the house and everyone's trips. */
  away: { today: string; periods: readonly AwayPeriod[] } | null;
  stake: Pick<StakeView, "month" | "stakeMinor" | "projection"> | null;
}): TodayPage {
  const { board, mine, userId, away, stake, rules } = input;
  const state = nextUpState({
    board,
    mine,
    userId,
    members: input.members,
    awayUntil: away ? awayTodayUntil(away.periods, userId, away.today) : null,
  });
  const shown = state.kind === "john" ? state.item : null;
  const cant = shown ? cantOptions(shown, board, input.me) : null;
  return {
    state,
    ...restOfWeek(mine, shown?.id ?? null),
    cant: { immunity: (cant?.immunity ?? 0) > 0, swap: (cant?.swapFor.length ?? 0) > 0 },
    room: shown ? forfeitRoom(stake, userId, monthOf(shown.dueAt, rules.timezone)) : null,
    away: away && state.kind !== "away" ? awayLine(away.periods, userId, away.today) : null,
    standing: board.week ? standingLine({ table: board.table, userId, stake, currency: rules.currency }) : null,
  };
}
