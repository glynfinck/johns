import "server-only";

import {
  liveStatus,
  monthOf,
  monthWindow,
  standings,
  standsAt,
  weekWindow,
  type LiveStatus,
  type Outcome,
  type TableRow,
} from "@app/core";

import type { HouseContext } from "./house";

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

export interface DisputeView {
  id: string;
  assignmentId: string;
  raisedBy: string | null;
  reason: string;
  closesAt: Date;
  uphold: number;
  reject: number;
  myVote: boolean | null;
}

export interface WeekBoard {
  week: { id: string; startsOn: string; startsAt: Date; endsAt: Date } | null;
  items: BoardItem[];
  table: TableRow[];
  /** Nothing has ever been dealt in this house. */
  notStarted: boolean;
}

/** This week's board: every John, its live status, and any dispute on it. */
export async function getWeekBoard(ctx: HouseContext): Promise<WeekBoard> {
  const { supabase, house, rules, now } = ctx;
  const window = weekWindow(now, rules.timezone, rules.weekStarts);
  const { data: week } = await supabase
    .from("weeks")
    .select("id, starts_on, starts_at, ends_at")
    .eq("house_id", house.id)
    .eq("starts_on", window.startsOn)
    .maybeSingle();

  const memberIds = ctx.members.map((m) => m.userId);
  if (!week) {
    return { week: null, items: [], table: standings([], memberIds), notStarted: !house.first_dealt_at };
  }

  const [{ data: rows }, { data: disputes }] = await Promise.all([
    supabase.from("assignments").select("*").eq("week_id", week.id).order("due_at"),
    supabase
      .from("disputes")
      .select("id, assignment_id, raised_by, reason, closes_at, dispute_votes(user_id, uphold)")
      .eq("house_id", house.id)
      .is("resolution", null),
  ]);

  const disputeBy = new Map<string, DisputeView>();
  for (const d of disputes ?? []) {
    const votes = d.dispute_votes ?? [];
    disputeBy.set(d.assignment_id, {
      id: d.id,
      assignmentId: d.assignment_id,
      raisedBy: d.raised_by,
      reason: d.reason,
      closesAt: new Date(d.closes_at),
      uphold: votes.filter((v) => v.uphold).length,
      reject: votes.filter((v) => !v.uphold).length,
      myVote: votes.find((v) => v.user_id === ctx.userId)?.uphold ?? null,
    });
  }

  const endsAt = new Date(week.ends_at);
  const items: BoardItem[] = (rows ?? []).map((a) => {
    const dispute = disputeBy.get(a.id) ?? null;
    const doneAt = a.done_at ? new Date(a.done_at) : null;
    const facts = {
      dueAt: new Date(a.due_at),
      doneAt,
      excused: a.excused,
      disputeOpen: dispute !== null,
      weekEndsAt: endsAt,
      outcome: a.outcome as Outcome | null,
    };
    const status = liveStatus(facts, now, rules.disputeHours);
    return {
      id: a.id,
      userId: a.user_id,
      name: a.name,
      category: a.category,
      points: a.points,
      needsPhoto: a.needs_photo,
      dueAt: facts.dueAt,
      movedFrom: a.due_moved_from ? new Date(a.due_moved_from) : null,
      groupName: a.group_name,
      doneAt,
      photoPath: a.photo_path,
      outcome: facts.outcome,
      status,
      standsAt: doneAt && !a.outcome ? standsAt(doneAt, rules.disputeHours) : null,
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

/** This month's table: every John due in the month so far, settled or live. */
export async function getMonthTable(ctx: HouseContext) {
  const { supabase, house, rules, now } = ctx;
  const month = monthOf(now, rules.timezone);
  const window = monthWindow(month, rules.timezone);
  const { data: rows } = await supabase
    .from("assignments")
    .select("user_id, points, outcome, done_at, due_at, excused, weeks(ends_at)")
    .eq("house_id", house.id)
    .gte("due_at", window.startsAt.toISOString())
    .lt("due_at", window.endsAt.toISOString());
  const table = standings(
    (rows ?? []).map((a) => ({
      userId: a.user_id,
      points: a.points,
      status: liveStatus(
        {
          dueAt: new Date(a.due_at),
          doneAt: a.done_at ? new Date(a.done_at) : null,
          excused: a.excused,
          disputeOpen: false,
          weekEndsAt: new Date(a.weeks!.ends_at),
          outcome: a.outcome as Outcome | null,
        },
        now,
        rules.disputeHours,
      ),
    })),
    ctx.members.map((m) => m.userId),
  );
  return { month, table };
}
