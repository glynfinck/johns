import type { SupabaseClient } from "@supabase/supabase-js";

import { verdict } from "@/lib/dispute";
import type { Currency, HouseRules, IsoDow, Outcome } from "@/lib/domain";
import { settleOutcome } from "@/lib/outcome";
import { standings, weekWinners } from "@/lib/points";
import { carryOver, fairShares, type PastWeek } from "@/lib/rota";
import { forfeitFor, settleMonth } from "@/lib/stake";
import { earnsImmunity, isCleanWeek } from "@/lib/streak";
import {
  dueAt,
  graceDue,
  isDueInWeek,
  monthOf,
  monthWindow,
  weekIndex,
  weekWindow,
  type WeekWindow,
} from "@/lib/week";
import type { Database } from "@/types/database";

/**
 * The engine: everything the clock does to a house.
 *
 * It decides with the pure rules in lib/ and applies each decision through
 * one service-role SQL function that refuses to apply it twice
 * (supabase/migrations/*_init.sql). So the tick is safe to run as often as
 * anyone likes, from pg_cron, from a page load (lib/engine/fresh.ts) or from
 * two of those at once.
 *
 * It takes the client and the time as arguments and imports nothing that
 * only runs on a server, which is what lets tests/db drive it directly.
 */

export type Db = SupabaseClient<Database>;
type HouseRow = Database["public"]["Tables"]["houses"]["Row"];
type MemberRow = Pick<
  Database["public"]["Tables"]["members"]["Row"],
  "user_id" | "role" | "joined_at" | "streak" | "immunity_tokens" | "swap_tokens"
>;

export interface PushMessage {
  title: string;
  body: string;
  url: string;
}

/** Sends a push to some housemates. Absent when nothing should be sent. */
export type Notify = (userIds: string[], message: PushMessage) => Promise<void>;

export interface TickSummary {
  dealt: string | null;
  disputes: number;
  settled: number;
  weeksClosed: number;
  monthsClosed: string[];
  reminders: number;
}

export function rulesOf(house: HouseRow): HouseRules {
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

type Ok<R> = Extract<R, { error: null }>;

/** Unwrap a Supabase response, or throw with what was being attempted. */
export function must<R extends { data: unknown; error: { message: string } | null }>(
  result: R,
  what: string,
): Ok<R>["data"] {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as Ok<R>["data"];
}

export async function loadHouse(db: Db, houseId: string) {
  const house = must(await db.from("houses").select("*").eq("id", houseId).single(), "house");
  const members = must(
    await db
      .from("members")
      .select("user_id, role, joined_at, streak, immunity_tokens, swap_tokens")
      .eq("house_id", houseId)
      .order("joined_at")
      .order("user_id"),
    "members",
  );
  return { house, members };
}

export async function tickHouse(
  db: Db,
  houseId: string,
  now: Date,
  notify?: Notify,
): Promise<TickSummary> {
  const { house, members } = await loadHouse(db, houseId);
  const summary: TickSummary = {
    dealt: null,
    disputes: 0,
    settled: 0,
    weeksClosed: 0,
    monthsClosed: [],
    reminders: 0,
  };

  if (house.rota_started_at) {
    summary.dealt = await ensureCurrentWeek(db, house, members, now, notify);
  }
  summary.disputes = await decideDisputes(db, house, members, now);
  summary.settled = await settleDue(db, house, now);
  summary.weeksClosed = await closeWeeks(db, house, members, now);
  summary.monthsClosed = await closeMonths(db, house, members, now);
  if (notify) summary.reminders = await sendReminders(db, house, now, notify);

  must(await db.from("houses").update({ ticked_at: now.toISOString() }).eq("id", house.id), "ticked_at");
  return summary;
}

/** Every house the clock has work in, one after another. One bad house never stops the rest. */
export async function tickAll(db: Db, now: Date, notify?: Notify) {
  const houses = must(await db.from("houses").select("id"), "houses");
  const results: { houseId: string; summary?: TickSummary; error?: string }[] = [];
  for (const h of houses) {
    try {
      results.push({ houseId: h.id, summary: await tickHouse(db, h.id, now, notify) });
    } catch (e) {
      results.push({ houseId: h.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

// --- Dealing ---------------------------------------------------------------

/**
 * Deal a week's Johhs with fair shares. With `replace`, re-deal a week nobody
 * has ticked anything in yet (deal_week refuses otherwise).
 */
export async function dealWeek(
  db: Db,
  house: HouseRow,
  members: readonly MemberRow[],
  week: WeekWindow,
  now: Date,
  replace: boolean,
): Promise<{ weekId: string | null; byUser: Map<string, string[]> }> {
  const rules = rulesOf(house);
  const index = weekIndex(week.startsOn);
  const johhs = must(
    await db.from("johhs").select("*").eq("house_id", house.id).is("archived_at", null),
    "johhs",
  ).filter((j) => isDueInWeek(j.every_weeks, j.anchor_week, index));

  const byUser = new Map<string, string[]>();
  if (johhs.length === 0 || members.length === 0) return { weekId: null, byUser };

  const recent = must(
    await db
      .from("assignments")
      .select("johh_id, user_id, due_at")
      .in("johh_id", johhs.map((j) => j.id))
      .lt("due_at", week.startsAt.toISOString())
      .order("due_at", { ascending: false })
      .limit(500),
    "recent assignments",
  );
  const lastBy = new Map<string, string>();
  for (const r of recent) if (r.johh_id && !lastBy.has(r.johh_id)) lastBy.set(r.johh_id, r.user_id);

  const pastWeeks = must(
    await db
      .from("weeks")
      .select("id, ends_at")
      .eq("house_id", house.id)
      .lt("starts_on", week.startsOn)
      .order("starts_on", { ascending: false })
      .limit(4),
    "past weeks",
  );
  const pastRows = pastWeeks.length
    ? must(
        await db
          .from("assignments")
          .select("week_id, user_id, points")
          .in("week_id", pastWeeks.map((w) => w.id)),
        "past assignments",
      )
    : [];
  const history: PastWeek[] = pastWeeks.map((w) => ({
    memberIds: members.filter((m) => new Date(m.joined_at) < new Date(w.ends_at)).map((m) => m.user_id),
    assignments: pastRows
      .filter((r) => r.week_id === w.id)
      .map((r) => ({ userId: r.user_id, points: r.points })),
  }));

  const rota = fairShares(
    johhs.map((j) => ({ johhId: j.id, points: j.points, lastUserId: lastBy.get(j.id) ?? null })),
    carryOver(history, members.map((m) => m.user_id)),
    `${house.id}:${week.startsOn}`,
  );

  const midWeek = now > week.startsAt;
  const assignments = rota.map((r) => {
    const j = johhs.find((x) => x.id === r.johhId)!;
    let due = dueAt(week, rules.timezone, rules.weekStarts, j.due_dow as IsoDow, j.due_time.slice(0, 5));
    if (midWeek) due = graceDue(due, now, week.endsAt);
    byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), j.name]);
    return {
      johh_id: j.id,
      user_id: r.userId,
      name: j.name,
      category: j.category,
      points: j.points,
      needs_photo: j.needs_photo,
      due_at: due.toISOString(),
    };
  });

  const weekId = must(
    await db.rpc("deal_week", {
      p_house: house.id,
      p_starts_on: week.startsOn,
      p_starts_at: week.startsAt.toISOString(),
      p_ends_at: week.endsAt.toISOString(),
      p_assignments: assignments,
      p_replace: replace,
    }),
    "deal_week",
  );
  return { weekId: weekId ?? null, byUser };
}

async function ensureCurrentWeek(
  db: Db,
  house: HouseRow,
  members: readonly MemberRow[],
  now: Date,
  notify?: Notify,
): Promise<string | null> {
  const rules = rulesOf(house);
  const week = weekWindow(now, rules.timezone, rules.weekStarts);
  const existing = must(
    await db.from("weeks").select("id").eq("house_id", house.id).eq("starts_on", week.startsOn).maybeSingle(),
    "current week",
  );
  if (existing) return null;
  const { weekId, byUser } = await dealWeek(db, house, members, week, now, false);
  if (weekId && notify) {
    for (const [userId, names] of byUser) {
      await notify([userId], {
        title: "This week's Johhs",
        body: names.join(", "),
        url: "/today",
      });
    }
  }
  return weekId;
}

// --- Disputes ----------------------------------------------------------------

async function decideDisputes(db: Db, house: HouseRow, members: readonly MemberRow[], now: Date) {
  const open = must(
    await db
      .from("disputes")
      .select("id, closes_at, assignments(user_id)")
      .eq("house_id", house.id)
      .is("resolution", null),
    "open disputes",
  );
  if (open.length === 0) return 0;
  const votes = must(
    await db.from("dispute_votes").select("dispute_id, user_id, uphold").in("dispute_id", open.map((d) => d.id)),
    "votes",
  );
  let decided = 0;
  for (const d of open) {
    const assignee = d.assignments?.user_id ?? null;
    const eligible = members.filter((m) => m.user_id !== assignee).length;
    const mine = votes.filter((v) => v.dispute_id === d.id && v.user_id !== assignee);
    const result = verdict(
      {
        eligible,
        uphold: mine.filter((v) => v.uphold).length,
        reject: mine.filter((v) => !v.uphold).length,
        closesAt: new Date(d.closes_at),
      },
      now,
    );
    if (!result) continue;
    const applied = must(await db.rpc("resolve_dispute", { p_dispute: d.id, p_resolution: result }), "resolve");
    if (applied) decided += 1;
  }
  return decided;
}

// --- Settling outcomes -----------------------------------------------------------

async function settleDue(db: Db, house: HouseRow, now: Date) {
  const rules = rulesOf(house);
  const open = must(
    await db
      .from("assignments")
      .select("id, due_at, done_at, excused, weeks(ends_at)")
      .eq("house_id", house.id)
      .is("outcome", null),
    "open assignments",
  );
  if (open.length === 0) return 0;
  const disputed = new Set(
    must(
      await db.from("disputes").select("assignment_id").eq("house_id", house.id).is("resolution", null),
      "disputed",
    ).map((d) => d.assignment_id),
  );

  const items: { id: string; outcome: Outcome; forfeit: number; month: string }[] = [];
  for (const a of open) {
    const outcome = settleOutcome(
      {
        dueAt: new Date(a.due_at),
        doneAt: a.done_at ? new Date(a.done_at) : null,
        excused: a.excused,
        disputeOpen: disputed.has(a.id),
        weekEndsAt: new Date(a.weeks!.ends_at),
      },
      now,
      rules.disputeHours,
    );
    if (!outcome) continue;
    items.push({
      id: a.id,
      outcome,
      forfeit: forfeitFor(outcome, rules),
      month: monthOf(new Date(a.due_at), rules.timezone),
    });
  }
  if (items.length === 0) return 0;
  return must(await db.rpc("settle_assignments", { p_items: items }), "settle");
}

// --- Closing weeks: streaks and perks -----------------------------------------------

async function closeWeeks(db: Db, house: HouseRow, members: readonly MemberRow[], now: Date) {
  const due = must(
    await db
      .from("weeks")
      .select("id, starts_on")
      .eq("house_id", house.id)
      .is("closed_at", null)
      .lte("ends_at", now.toISOString())
      .order("starts_on"),
    "weeks to close",
  );
  const streaks = new Map(members.map((m) => [m.user_id, m.streak]));
  let closed = 0;

  for (const week of due) {
    const rows = must(
      await db.from("assignments").select("user_id, points, outcome").eq("week_id", week.id),
      "week assignments",
    );
    // Weeks close in order, so a streak always counts the week before it.
    if (rows.some((r) => r.outcome === null)) break;

    const table = standings(
      rows.map((r) => ({ userId: r.user_id, points: r.points, status: r.outcome as Outcome })),
      members.map((m) => m.user_id),
    );
    const winners = new Set(weekWinners(table));

    const payload = members.map((m) => {
      const outcomes = rows.filter((r) => r.user_id === m.user_id).map((r) => r.outcome as Outcome);
      const before = streaks.get(m.user_id) ?? 0;
      const clean = isCleanWeek(outcomes);
      const after = clean === null ? before : clean ? before + 1 : 0;
      const earn: string[] = [];
      if (earnsImmunity(before, after)) earn.push("immunity");
      if (winners.has(m.user_id)) earn.push("swap");
      return { user_id: m.user_id, streak: after, earn };
    });

    const applied = must(await db.rpc("close_week", { p_week: week.id, p_members: payload }), "close_week");
    if (!applied) break;
    for (const p of payload) streaks.set(p.user_id, p.streak);
    closed += 1;
  }
  return closed;
}

// --- Closing months: the Stake ----------------------------------------------------------

async function closeMonths(db: Db, house: HouseRow, members: readonly MemberRow[], now: Date) {
  const rules = rulesOf(house);
  const current = monthOf(now, rules.timezone);
  const forfeitRows = must(
    await db
      .from("ledger")
      .select("user_id, amount_minor, month")
      .eq("house_id", house.id)
      .eq("kind", "forfeit")
      .lt("month", current),
    "forfeits",
  );
  if (forfeitRows.length === 0) return [];
  const done = new Set(
    must(await db.from("month_closes").select("month").eq("house_id", house.id), "month closes").map(
      (m) => m.month,
    ),
  );
  const months = [...new Set(forfeitRows.map((r) => r.month))].filter((m) => !done.has(m)).sort();

  const closed: string[] = [];
  for (const month of months) {
    // A month closes once nothing due in it can still change.
    const window = monthWindow(month, rules.timezone);
    const { count, error } = await db
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("house_id", house.id)
      .is("outcome", null)
      .lt("due_at", window.endsAt.toISOString());
    if (error) throw new Error(`unsettled: ${error.message}`);
    if ((count ?? 0) > 0) break;

    const settlement = settleMonth(
      members.map((m) => m.user_id),
      rules.stakeMinor,
      forfeitRows.filter((r) => r.month === month).map((r) => ({ userId: r.user_id, amount: -r.amount_minor })),
    );
    const applied = must(
      await db.rpc("close_month", {
        p_house: house.id,
        p_month: month,
        p_entries: settlement.entries.map((e) => ({ user_id: e.userId, kind: e.kind, amount: e.amount })),
      }),
      "close_month",
    );
    if (applied) closed.push(month);
  }
  return closed;
}

// --- Reminders -----------------------------------------------------------------------------

const HOUR = 3_600_000;

async function sendReminders(db: Db, house: HouseRow, now: Date, notify: Notify) {
  const soon = must(
    await db
      .from("assignments")
      .select("id, user_id, name, due_at, reminded")
      .eq("house_id", house.id)
      .is("outcome", null)
      .is("done_at", null)
      .lt("reminded", 2)
      .gt("due_at", now.toISOString())
      .lte("due_at", new Date(now.getTime() + 24 * HOUR).toISOString()),
    "reminders",
  );
  let sent = 0;
  for (const a of soon) {
    const left = new Date(a.due_at).getTime() - now.getTime();
    const stage = left <= 3 * HOUR ? 2 : 1;
    if (a.reminded >= stage) continue;
    // Claim the reminder before sending it, so two ticks never both send.
    const claimed = must(
      await db
        .from("assignments")
        .update({ reminded: stage })
        .eq("id", a.id)
        .lt("reminded", stage)
        .select("id"),
      "claim reminder",
    );
    if (claimed.length === 0) continue;
    await notify([a.user_id], {
      title: stage === 2 ? `${a.name} is due soon` : `${a.name} is due tomorrow`,
      body: stage === 2 ? "A few hours left to get it done on time." : "Tick it off when it's done.",
      url: "/today",
    });
    sent += 1;
  }
  return sent;
}
