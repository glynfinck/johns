import type { Database } from "./db-types";
import type { Currency, HouseRules, IsoDow, Outcome } from "./domain";
import { liveStatus, standsAt, type LiveStatus } from "./outcome";
import { standings, type TableRow } from "./points";

// The week as both apps show it, built from the rows they each read through
// RLS (the web on the server, the native app on the phone), so the two can't
// disagree about what a John's status is.

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

/** The house's rules, from its row. */
export function rulesOf(
  house: Pick<
    Row<"houses">,
    | "timezone"
    | "currency"
    | "week_starts"
    | "stake_minor"
    | "late_forfeit_minor"
    | "missed_forfeit_minor"
    | "dispute_hours"
  >,
): HouseRules {
  return {
    timezone: house.timezone,
    currency: house.currency as Currency,
    weekStarts: house.week_starts as IsoDow,
    stakeMinor: house.stake_minor,
    lateForfeitMinor: house.late_forfeit_minor,
    missedForfeitMinor: house.missed_forfeit_minor,
    disputeHours: house.dispute_hours,
  };
}

export type WeekRow = Pick<Row<"weeks">, "id" | "starts_on" | "starts_at" | "ends_at">;

export type AssignmentRow = Pick<
  Row<"assignments">,
  | "id"
  | "user_id"
  | "name"
  | "category"
  | "points"
  | "needs_photo"
  | "due_at"
  | "due_moved_from"
  | "group_name"
  | "done_at"
  | "photo_path"
  | "outcome"
  | "excused"
>;

/** An open dispute, with its votes: `disputes` and `dispute_votes` as read. */
export interface DisputeRow {
  id: string;
  assignment_id: string;
  raised_by: string | null;
  reason: string;
  closes_at: string;
  dispute_votes: { user_id: string; uphold: boolean }[] | null;
}

export interface DisputeView {
  id: string;
  assignmentId: string;
  raisedBy: string | null;
  reason: string;
  closesAt: Date;
  uphold: number;
  reject: number;
  /** How the viewer voted, or null if they haven't. */
  myVote: boolean | null;
}

export interface BoardItem {
  id: string;
  userId: string;
  name: string;
  category: string;
  points: number;
  needsPhoto: boolean;
  dueAt: Date;
  /** Set when time away pulled the due date forward: when it was due before. */
  movedFrom: Date | null;
  /** The group it belongs to, as dealt; null for everyone's. */
  groupName: string | null;
  doneAt: Date | null;
  photoPath: string | null;
  outcome: Outcome | null;
  status: LiveStatus;
  /** When a tick in the dispute window stands, if nothing changes. */
  standsAt: Date | null;
  dispute: DisputeView | null;
}

export interface WeekBoard {
  week: { id: string; startsOn: string; startsAt: Date; endsAt: Date } | null;
  items: BoardItem[];
  table: TableRow[];
  /** Nothing has ever been dealt in this house. */
  notStarted: boolean;
}

/**
 * This week's board: every John with its live status and any open dispute
 * on it, and the week's table. `week` is null when this week hasn't been
 * dealt; `everDealt` says whether any week ever has.
 */
export function buildWeekBoard(input: {
  week: WeekRow | null;
  assignments: readonly AssignmentRow[];
  disputes: readonly DisputeRow[];
  memberIds: readonly string[];
  /** Whose votes count as "mine". */
  userId: string;
  everDealt: boolean;
  disputeHours: number;
  now: Date;
}): WeekBoard {
  const { week, now, disputeHours, memberIds } = input;
  if (!week) return { week: null, items: [], table: standings([], memberIds), notStarted: !input.everDealt };

  const disputeBy = new Map<string, DisputeView>();
  for (const d of input.disputes) {
    const votes = d.dispute_votes ?? [];
    disputeBy.set(d.assignment_id, {
      id: d.id,
      assignmentId: d.assignment_id,
      raisedBy: d.raised_by,
      reason: d.reason,
      closesAt: new Date(d.closes_at),
      uphold: votes.filter((v) => v.uphold).length,
      reject: votes.filter((v) => !v.uphold).length,
      myVote: votes.find((v) => v.user_id === input.userId)?.uphold ?? null,
    });
  }

  const endsAt = new Date(week.ends_at);
  const items: BoardItem[] = [...input.assignments]
    .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at))
    .map((a) => {
      const dispute = disputeBy.get(a.id) ?? null;
      const doneAt = a.done_at ? new Date(a.done_at) : null;
      const outcome = a.outcome as Outcome | null;
      const dueAt = new Date(a.due_at);
      const status = liveStatus(
        { dueAt, doneAt, excused: a.excused, disputeOpen: dispute !== null, weekEndsAt: endsAt, outcome },
        now,
        disputeHours,
      );
      return {
        id: a.id,
        userId: a.user_id,
        name: a.name,
        category: a.category,
        points: a.points,
        needsPhoto: a.needs_photo,
        dueAt,
        movedFrom: a.due_moved_from ? new Date(a.due_moved_from) : null,
        groupName: a.group_name,
        doneAt,
        photoPath: a.photo_path,
        outcome,
        status,
        standsAt: doneAt && !outcome ? standsAt(doneAt, disputeHours) : null,
        dispute,
      };
    });

  return {
    week: { id: week.id, startsOn: week.starts_on, startsAt: new Date(week.starts_at), endsAt },
    items,
    table: standings(
      items.map((i) => ({ userId: i.userId, points: i.points, status: i.status })),
      memberIds,
    ),
    notStarted: false,
  };
}

/** Still to do: not ticked, not excused, not yet settled. */
export function isOpen(status: LiveStatus): boolean {
  return status === "overdue" || status === "due-soon" || status === "upcoming";
}

/** Today's order: what needs doing first, then what's being checked, then what's settled. */
export const TODAY_ORDER: Record<LiveStatus, number> = {
  overdue: 0,
  "due-soon": 1,
  upcoming: 2,
  disputed: 3,
  checking: 4,
  late: 5,
  done: 6,
  excused: 7,
  missed: 8,
};

/** Today for one housemate: their Johns in Today's order, how many are left, and what awaits their vote. */
export function todayView(board: WeekBoard, userId: string) {
  const mine = board.items
    .filter((i) => i.userId === userId)
    .sort((a, b) => TODAY_ORDER[a.status] - TODAY_ORDER[b.status] || a.dueAt.getTime() - b.dueAt.getTime());
  return {
    mine,
    left: mine.filter((i) => isOpen(i.status)).length,
    toVote: board.items.filter((i) => i.dispute && i.userId !== userId && i.dispute.myVote === null),
  };
}

/** A month's assignment as read, with its week's end (for when an open John turns missed). */
export type MonthRow = Pick<Row<"assignments">, "user_id" | "points" | "outcome" | "done_at" | "due_at" | "excused"> & {
  weeks: { ends_at: string } | null;
};

/** The month's Table: every John due this month, each at its live status. */
export function monthStandings(
  rows: readonly MonthRow[],
  memberIds: readonly string[],
  disputeHours: number,
  now: Date,
): TableRow[] {
  return standings(
    rows.map((a) => ({
      userId: a.user_id,
      points: a.points,
      status: liveStatus(
        {
          dueAt: new Date(a.due_at),
          doneAt: a.done_at ? new Date(a.done_at) : null,
          excused: a.excused,
          disputeOpen: false,
          // A John with no week (never, in practice) counts as ending when it's due.
          weekEndsAt: new Date(a.weeks?.ends_at ?? a.due_at),
          outcome: a.outcome as Outcome | null,
        },
        now,
        disputeHours,
      ),
    })),
    memberIds,
  );
}
