import { isOpen, type BoardItem } from "./board";
import { FOCUS_SHELL_COPY, JOHN_SHEET_COPY, NEXT_UP_COPY, WEEK_SUMMARY_COPY } from "./copy";
import { CATEGORY_SHORT } from "./domain";
import { dueInLine, firstName, relative, sinceLabel, STATUS_LABEL } from "./format";
import type { LiveStatus } from "./outcome";
import { pointsEarned } from "./points";

// A John as a row, the same wherever it's drawn: Today's rest of your week,
// Week's groups and its laptop table. The circle and what it says, the meta
// line, and the one trailing item, from the kit's row map, for anyone's
// John and whoever is looking; and the fold the finished ones go into.
// Pure: `now` comes in, and times are in the house's zone.

/**
 * A John's kind, as every line about it says it (its rows, Next up, the
 * John sheet): the short word, so the line keeps room for when. Anything
 * unknown is "Other".
 */
export function johnKind(category: string): string {
  return (CATEGORY_SHORT as Partial<Record<string, string>>)[category] ?? CATEGORY_SHORT.other;
}

/** What a John's row shows and does. */
export interface JohnRowPlan {
  /** The leading circle (excused shows a shield instead). */
  circle: "open" | "checking" | "done" | "disputed" | "excused";
  /** What the circle says: the move when it ticks ("Mark Bins out done"), otherwise where the John has got to. */
  circleLabel: string;
  /** The circle ticks it: yours, and still to do (overdue too; a missed one never). */
  ticks: boolean;
  /** The meta line: the kind, then where it has got to; a dispute says who raised it instead. */
  meta: string;
  /** Whether the lid dot leads the meta line (not before a dispute's "Disputed by"). */
  lid: boolean;
  /**
   * The one trailing item. The points while it's upcoming (it has no mark),
   * once it's done (the green circle says done) and while it's disputed
   * (the flag says that); its mark when due soon, being checked by the
   * house, late, overdue or missed; Undo on your own tick being checked;
   * Vote on a dispute waiting for yours; nothing once immunity excused it.
   */
  trailing: "points" | "status" | "undo" | "vote" | null;
  /** Its points: what it's worth while still in play, what it earned once settled. */
  points: number;
  /** What the John sheet opens on: a housemate's fresh tick to dispute, a dispute's vote. */
  focus: "dispute" | "vote" | null;
  /** The 4pt hazard edge of an overdue or missed John. */
  hazardEdge: boolean;
}

/** A dispute on a housemate's John that you haven't voted on yet. */
function waitsForYourVote(item: Pick<BoardItem, "userId" | "status" | "dispute">, viewerId: string): boolean {
  return item.userId !== viewerId && item.status === "disputed" && item.dispute !== null && item.dispute.myVote === null;
}

/** What a circle that doesn't tick says: where the John has got to, or just that it isn't done. */
function circleSays(status: LiveStatus): string {
  switch (status) {
    case "checking":
    case "done":
    case "late":
    case "disputed":
    case "missed":
    case "excused":
      return NEXT_UP_COPY.stateLabel[status];
    default:
      return NEXT_UP_COPY.stateLabel.open;
  }
}

/** Someone by first name mid-sentence, or "a former housemate" once they've left (no name). */
function called(name: string | null): string {
  return name ? firstName(name) : NEXT_UP_COPY.someoneGone;
}

/**
 * One John's row, for whoever is looking (`viewerId`). Its meta line never
 * repeats what the circle or the trailing item already says: "Kitchen ·
 * today 21:00", "Kitchen · was due Tue", "Bins · stands in 21h", "Floors ·
 * done Wed 21:00", "Disputed by Megan · 17h left".
 */
export function johnRow(
  item: Pick<
    BoardItem,
    "userId" | "name" | "category" | "points" | "needsPhoto" | "status" | "dueAt" | "movedFrom" | "doneAt" | "standsAt" | "dispute"
  >,
  viewerId: string,
  now: Date,
  zone: string,
  /** Anyone's full name, or null for someone who has left. */
  nameOf: (userId: string) => string | null,
): JohnRowPlan {
  const { status } = item;
  const mine = item.userId === viewerId;
  const toDo = status === "upcoming" || status === "due-soon" || status === "overdue";
  const waitingForMe = waitsForYourVote(item, viewerId);
  const circle: JohnRowPlan["circle"] =
    status === "checking" || status === "disputed"
      ? status
      : status === "done" || status === "late"
        ? "done"
        : status === "excused"
          ? "excused"
          : "open";
  const ticks = mine && toDo;
  const { meta, lid } = metaLine(item, viewerId, now, zone, nameOf);
  return {
    circle,
    circleLabel: ticks
      ? item.needsPhoto
        ? NEXT_UP_COPY.tickWithPhoto(item.name)
        : NEXT_UP_COPY.tick(item.name)
      : circleSays(status),
    ticks,
    meta,
    lid,
    trailing:
      status === "checking"
        ? mine
          ? "undo"
          : "status"
        : status === "disputed"
          ? waitingForMe
            ? "vote"
            : "points"
          : status === "excused"
            ? null
            : status === "upcoming" || status === "done"
              ? "points"
              : "status",
    points: isOpen(status) ? item.points : pointsEarned(status, item.points),
    // Everyone but the ticker votes, so your own dispute opens on nothing in particular.
    focus: status === "disputed" && !mine ? "vote" : status === "checking" && !mine ? "dispute" : null,
    hazardEdge: status === "overdue" || status === "missed",
  };
}

/** The row's meta line, and whether its lid dot leads it. */
function metaLine(
  item: Pick<BoardItem, "userId" | "category" | "status" | "dueAt" | "movedFrom" | "doneAt" | "standsAt" | "dispute">,
  viewerId: string,
  now: Date,
  zone: string,
  nameOf: (userId: string) => string | null,
): { meta: string; lid: boolean } {
  const mine = item.userId === viewerId;
  const line = (...parts: string[]) => ({ meta: [johnKind(item.category), ...parts].join(" · "), lid: true });
  const due = dueInLine(item.dueAt, now, zone);

  switch (item.status) {
    case "disputed": {
      const dispute = item.dispute;
      if (!dispute) return { meta: STATUS_LABEL.disputed, lid: false };
      const by =
        dispute.raisedBy === null
          ? NEXT_UP_COPY.someoneGone
          : dispute.raisedBy === viewerId
            ? WEEK_SUMMARY_COPY.byYou
            : called(nameOf(dispute.raisedBy));
      const left =
        dispute.closesAt > now ? NEXT_UP_COPY.left(relative(dispute.closesAt, now).replace(/^in /, "")) : NEXT_UP_COPY.closingNow;
      return { meta: `${JOHN_SHEET_COPY.disputedBy(by)} · ${left}`, lid: false };
    }
    case "checking":
      if (!item.standsAt) return line();
      return line(item.standsAt > now ? JOHN_SHEET_COPY.standsIn(relative(item.standsAt, now)) : JOHN_SHEET_COPY.standsSoon);
    case "overdue":
    case "missed":
      return line(NEXT_UP_COPY.wasDue(sinceLabel(item.dueAt, now, zone)));
    case "done":
    case "late":
      return line(item.doneAt ? NEXT_UP_COPY.done(dueInLine(item.doneAt, now, zone)) : due);
    case "excused":
      return line(NEXT_UP_COPY.excused);
    default:
      // Pulled forward by someone's time away: say so.
      if (item.movedFrom) {
        const before = mine ? NEXT_UP_COPY.beforeYouGo : WEEK_SUMMARY_COPY.beforeTheyGo(called(nameOf(item.userId)));
        return line(`${due}, ${before}`);
      }
      return line(due);
  }
}

/**
 * The fold finished Johns go into, on Today and Week alike: "Done (2)", and
 * how many of those were late ("1 late", hazard words after it), or null
 * for none.
 */
export function doneFold(folded: readonly { status: LiveStatus }[]): { label: string; late: string | null } {
  const late = folded.filter((i) => i.status === "late").length;
  return { label: FOCUS_SHELL_COPY.done(folded.length), late: late > 0 ? WEEK_SUMMARY_COPY.late(late) : null };
}
