import "server-only";

import {
  buildWeekBoard,
  liveStatus,
  monthOf,
  monthWindow,
  standings,
  weekWindow,
  type Outcome,
  type WeekBoard,
} from "@app/core";

import type { HouseContext } from "./house";

export type { BoardItem, DisputeView, WeekBoard } from "@app/core";

/** This week's board: every John, its live status, and any dispute on it (built in core). */
export async function getWeekBoard(ctx: HouseContext): Promise<WeekBoard> {
  const { supabase, house, rules, now } = ctx;
  const window = weekWindow(now, rules.timezone, rules.weekStarts);
  const { data: week } = await supabase
    .from("weeks")
    .select("id, starts_on, starts_at, ends_at")
    .eq("house_id", house.id)
    .eq("starts_on", window.startsOn)
    .maybeSingle();

  const [{ data: rows }, { data: disputes }] = week
    ? await Promise.all([
        supabase.from("assignments").select("*").eq("week_id", week.id).order("due_at"),
        supabase
          .from("disputes")
          .select("id, assignment_id, raised_by, reason, closes_at, dispute_votes(user_id, uphold)")
          .eq("house_id", house.id)
          .is("resolution", null),
      ])
    : [{ data: [] }, { data: [] }];

  return buildWeekBoard({
    week: week ?? null,
    assignments: rows ?? [],
    disputes: disputes ?? [],
    memberIds: ctx.members.map((m) => m.userId),
    userId: ctx.userId,
    everDealt: Boolean(house.first_dealt_at),
    disputeHours: rules.disputeHours,
    now,
  });
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
