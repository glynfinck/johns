import {
  BALANCE_WEEKS,
  awayOn,
  dueAt,
  dueInLine,
  earnsImmunity,
  fairShares,
  forfeitFor,
  graceDue,
  homeForWeek,
  isCleanWeek,
  isDueInWeek,
  localDate,
  monthOf,
  monthWindow,
  NOTIFY_COPY,
  ON_CALL_COPY,
  prefsOf,
  recentBalances,
  reminderFor,
  rulesOf,
  settleMonth,
  settleOutcome,
  standings,
  verdict,
  weekIndex,
  weekShares,
  weekWindow,
  weekWinners,
  type AwayPeriod,
  type Database,
  type DealJohn,
  type IsoDow,
  type Outcome,
  type PushKind,
  type WeekWindow,
} from "@app/core";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The engine: everything the clock does to a house.
 *
 * It decides with the pure rules in @app/core and applies each decision
 * through one service-role SQL function that refuses to apply it twice
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
  /** Which setting it answers to (@app/core notify.ts). */
  kind: PushKind;
  /** The house's zone, for quiet hours saved without one. */
  zone: string;
  /** A button to answer it from the notification: tick this John, or vote on this dispute. */
  act?: { assignmentId: string } | { disputeId: string };
  /** A later push with the same tag replaces this one, rather than stacking. */
  tag?: string;
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

// The house's rules from its row live in core, beside the board both apps build.
export { rulesOf };

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

  if (house.first_dealt_at) {
    summary.dealt = await ensureCurrentWeek(db, house, members, now, notify);
  }
  summary.disputes = await decideDisputes(db, house, members, now);
  summary.settled = await settleDue(db, house, now, notify);
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
 * Each housemate's balance going into a week: what they were handed minus
 * their share, over the weeks before it (@app/core deal.ts). Reads through whatever
 * client it is given, so a screen can show the same number the deal used.
 */
export async function loadBalances(
  db: Db,
  houseId: string,
  beforeStartsOn: string,
  memberIds: readonly string[],
): Promise<{ balances: Map<string, number>; usualShare: Map<string, number> }> {
  const pastWeeks = must(
    await db
      .from("weeks")
      .select("id")
      .eq("house_id", houseId)
      .lt("starts_on", beforeStartsOn)
      .order("starts_on", { ascending: false })
      .limit(BALANCE_WEEKS),
    "past weeks",
  );
  const ids = pastWeeks.map((w) => w.id);
  const [shares, handed] = ids.length
    ? await Promise.all([
        db.from("week_shares").select("week_id, user_id, share").in("week_id", ids),
        db.from("assignments").select("week_id, user_id, points, outcome, covered_by").in("week_id", ids),
      ]).then(([a, b]) => [must(a, "shares"), must(b, "past assignments")] as const)
    : [[], []];
  return recentBalances({ weekIds: ids, shares, handed }, memberIds);
}

/**
 * Deal a week's Johns with fair shares. With `replace`, re-deal a week nobody
 * has ticked anything in yet (deal_week refuses otherwise).
 *
 * A John with a group goes only to that group's members (or to everyone, if
 * nobody in the group lives here any more); nobody is handed a John due on a
 * day they are away; a John nobody who shares it is home for is skipped.
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
  const memberIds = members.map((m) => m.user_id);
  const johns = must(
    await db.from("johns").select("*").eq("house_id", house.id).is("archived_at", null),
    "johns",
  ).filter((j) => isDueInWeek(j.every_weeks, j.anchor_week, index));

  const byUser = new Map<string, string[]>();
  if (johns.length === 0 || members.length === 0) return { weekId: null, byUser };

  const lastDay = localDate(new Date(week.endsAt.getTime() - 1), rules.timezone);
  const [groups, awayRows, recent] = await Promise.all([
    db.from("groups").select("id, name, group_members(user_id)").eq("house_id", house.id),
    db
      .from("away")
      .select("id, user_id, starts_on, ends_on, note")
      .eq("house_id", house.id)
      .lte("starts_on", lastDay)
      .gte("ends_on", week.startsOn),
    db
      .from("assignments")
      .select("john_id, user_id, due_at")
      .in("john_id", johns.map((j) => j.id))
      .lt("due_at", week.startsAt.toISOString())
      .order("due_at", { ascending: false })
      .limit(500),
  ]).then(([g, a, r]) => [must(g, "groups"), must(a, "away"), must(r, "recent assignments")] as const);

  const lastBy = new Map<string, string>();
  for (const r of recent) if (r.john_id && !lastBy.has(r.john_id)) lastBy.set(r.john_id, r.user_id);
  const away: AwayPeriod[] = awayRows.map((a) => ({
    id: a.id,
    userId: a.user_id,
    startsOn: a.starts_on,
    endsOn: a.ends_on,
    note: a.note,
  }));

  const midWeek = now > week.startsAt;
  const sharersOf = (j: (typeof johns)[number]) => {
    const group = j.group_id ? groups.find((g) => g.id === j.group_id) : undefined;
    const inGroup = (group?.group_members ?? []).map((m) => m.user_id).filter((id) => memberIds.includes(id));
    return { sharers: inGroup.length > 0 ? inGroup : memberIds, groupName: inGroup.length > 0 ? group!.name : null };
  };
  const planned = johns
    .filter((j) => j.kind !== "on_call")
    .map((j) => {
      let due = dueAt(week, rules.timezone, rules.weekStarts, j.due_dow as IsoDow, j.due_time.slice(0, 5));
      if (midWeek) due = graceDue(due, now, week.endsAt);
      const { sharers, groupName } = sharersOf(j);
      const day = localDate(due, rules.timezone);
      const deal: DealJohn = {
        johnId: j.id,
        points: j.points,
        lastUserId: lastBy.get(j.id) ?? null,
        sharers,
        home: sharers.filter((id) => !awayOn(away, id, day)),
      };
      return { john: j, due, groupName, deal };
    });

  // An on-call John puts someone on call for the week. It weighs in the deal
  // as often as it needs doing, but adds nothing to the stored shares: each
  // flag adds its own points when it is raised (open_flag), so what the house
  // owes follows what it was actually handed.
  const onCall = johns.filter((j) => j.kind === "on_call");
  const lastOnCall = new Map<string, string>();
  if (onCall.length > 0) {
    const previous = must(
      await db
        .from("on_call")
        .select("john_id, user_id, weeks!inner(starts_on)")
        .in("john_id", onCall.map((j) => j.id))
        .lt("weeks.starts_on", week.startsOn)
        .order("starts_on", { referencedTable: "weeks", ascending: false })
        .limit(200),
      "last on call",
    );
    for (const r of previous) if (!lastOnCall.has(r.john_id)) lastOnCall.set(r.john_id, r.user_id);
  }
  const onCallDeals: DealJohn[] = onCall.map((j) => {
    const { sharers } = sharersOf(j);
    return {
      johnId: j.id,
      points: j.points * j.per_week,
      lastUserId: lastOnCall.get(j.id) ?? null,
      sharers,
      home: homeForWeek(away, sharers, week.startsOn, lastDay),
    };
  });

  const dayDeals = planned.map((p) => p.deal);
  const makeup = house.away_makeup / 100;
  const shares = weekShares(dayDeals, memberIds, makeup);
  const weighed = weekShares([...dayDeals, ...onCallDeals], memberIds, makeup);
  const { balances } = await loadBalances(db, house.id, week.startsOn, memberIds);
  const dealt = fairShares(
    [...dayDeals, ...onCallDeals],
    memberIds.map((id) => ({ userId: id, balance: balances.get(id) ?? 0, share: weighed.get(id) ?? 0 })),
    `${house.id}:${week.startsOn}`,
  );

  const assignments = dealt.flatMap((d) => {
    const p = planned.find((x) => x.john.id === d.johnId);
    if (!p) return [];
    byUser.set(d.userId, [...(byUser.get(d.userId) ?? []), p.john.name]);
    return [
      {
        john_id: p.john.id,
        user_id: d.userId,
        name: p.john.name,
        category: p.john.category,
        points: p.john.points,
        needs_photo: p.john.needs_photo,
        due_at: p.due.toISOString(),
        group_name: p.groupName,
      },
    ];
  });
  const onCallRows = dealt.flatMap((d) => {
    const j = onCall.find((x) => x.id === d.johnId);
    if (!j) return [];
    byUser.set(d.userId, [...(byUser.get(d.userId) ?? []), ON_CALL_COPY.dealtAs(j.name)]);
    return [{ john_id: j.id, user_id: d.userId }];
  });

  const weekId = must(
    await db.rpc("deal_week", {
      p_house: house.id,
      p_starts_on: week.startsOn,
      p_starts_at: week.startsAt.toISOString(),
      p_ends_at: week.endsAt.toISOString(),
      p_assignments: assignments,
      p_shares: memberIds.map((id) => ({ user_id: id, share: Math.round((shares.get(id) ?? 0) * 100) / 100 })),
      p_replace: replace,
      p_on_call: onCallRows,
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
        title: NOTIFY_COPY.dealTitle,
        body: names.join(", "),
        url: "/today",
        kind: "deal",
        zone: rules.timezone,
        tag: `deal:${weekId}`,
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
      .select("id, closes_at, assignments(user_id, covered_by)")
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
    // Whose tick it is: the coverer's, for a cover. They don't vote on it.
    const ticker = d.assignments?.covered_by ?? d.assignments?.user_id ?? null;
    const eligible = members.filter((m) => m.user_id !== ticker).length;
    const mine = votes.filter((v) => v.dispute_id === d.id && v.user_id !== ticker);
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

async function settleDue(db: Db, house: HouseRow, now: Date, notify?: Notify) {
  const rules = rulesOf(house);
  const open = must(
    await db
      .from("assignments")
      .select("id, john_id, due_at, done_at, excused, flagged_at, closes_at, covered_by, weeks(ends_at)")
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
        flaggedAt: a.flagged_at ? new Date(a.flagged_at) : null,
        closesAt: a.closes_at ? new Date(a.closes_at) : null,
        coveredBy: a.covered_by,
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
  const settled = must(await db.rpc("settle_assignments", { p_items: items }), "settle");

  // A missed flag still needs doing: it opens again for whoever is on call
  // now. The miss stays with whoever had it. open_flag hands back a flag
  // that's already open, so two ticks racing open one.
  const missedFlags = new Set(
    open.filter((a) => a.flagged_at && a.john_id && items.some((i) => i.id === a.id && i.outcome === "missed")).map((a) => a.john_id!),
  );
  for (const johnId of missedFlags) await reopenFlag(db, house, johnId, now, notify);
  return settled;
}

/** Flag an on-call John again after a miss, and tell whoever it went to. Nobody home, or no week dealt, leaves it. */
async function reopenFlag(db: Db, house: HouseRow, johnId: string, now: Date, notify?: Notify) {
  const { data: flagId, error } = await db.rpc("open_flag", { p_john: johnId, p_at: now.toISOString() });
  if (error || !flagId) return;
  const flag = must(
    await db.from("assignments").select("user_id, name, due_at, needs_photo, flagged_by, flagged_at").eq("id", flagId).single(),
    "reopened flag",
  );
  // An older flag already open, from a housemate, was told about when it was raised.
  if (!notify || flag.flagged_by !== null || !flag.flagged_at || Date.parse(flag.flagged_at) !== now.getTime()) return;
  await notify([flag.user_id], {
    title: ON_CALL_COPY.pushTitle(flag.name),
    body: ON_CALL_COPY.pushAgainBody(dueInLine(new Date(flag.due_at), now, rulesOf(house).timezone)),
    url: "/today",
    kind: "flags",
    zone: rulesOf(house).timezone,
    ...(flag.needs_photo ? {} : { act: { assignmentId: flagId } }),
    tag: `john:${flagId}`,
  });
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
      await db.from("assignments").select("user_id, points, outcome, covered_by").eq("week_id", week.id),
      "week assignments",
    );
    // Weeks close in order, so a streak always counts the week before it.
    if (rows.some((r) => r.outcome === null)) break;

    const table = standings(
      rows.map((r) => ({ userId: r.user_id, points: r.points, status: r.outcome as Outcome, coveredBy: r.covered_by })),
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
      .select("user_id, amount_minor, month, counterparty")
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
      forfeitRows
        .filter((r) => r.month === month)
        .map((r) => ({ userId: r.user_id, amount: -r.amount_minor, to: r.counterparty })),
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

/**
 * The day before a John is due, and again a few hours before, its owner hears
 * what's due and when, with a Done button unless it needs a photo. Each stage
 * is sent once (`assignments.reminded`). Someone who turned reminders off is
 * passed over for good; someone in quiet hours is passed over until a tick
 * after they end, while there's still time.
 */
async function sendReminders(db: Db, house: HouseRow, now: Date, notify: Notify) {
  const zone = rulesOf(house).timezone;
  const soon = must(
    await db
      .from("assignments")
      .select("id, user_id, name, due_at, needs_photo, reminded")
      .eq("house_id", house.id)
      .is("outcome", null)
      .is("done_at", null)
      .lt("reminded", 2)
      .gt("due_at", now.toISOString())
      .lte("due_at", new Date(now.getTime() + 24 * HOUR).toISOString()),
    "reminders",
  );
  if (soon.length === 0) return 0;
  const prefs = must(
    await db
      .from("notification_prefs")
      .select("user_id, reminders, checks, flags, deal, quiet_from, quiet_until, timezone")
      .in("user_id", [...new Set(soon.map((a) => a.user_id))]),
    "notification settings",
  );
  let sent = 0;
  for (const a of soon) {
    const left = new Date(a.due_at).getTime() - now.getTime();
    const stage = left <= 3 * HOUR ? 2 : 1;
    if (a.reminded >= stage) continue;
    const when = reminderFor(prefsOf(prefs.find((p) => p.user_id === a.user_id)), now, zone);
    if (when === "wait") continue;
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
    if (claimed.length === 0 || when === "skip") continue;
    const due = dueInLine(new Date(a.due_at), now, zone);
    const body = stage === 2 ? NOTIFY_COPY.dueSoonBody(due) : NOTIFY_COPY.dueTomorrowBody(due);
    await notify([a.user_id], {
      title: stage === 2 ? NOTIFY_COPY.dueSoonTitle(a.name) : NOTIFY_COPY.dueTomorrowTitle(a.name),
      body: a.needs_photo ? `Due ${due}. ${NOTIFY_COPY.needsPhoto}` : body,
      url: "/today",
      kind: "reminders",
      zone,
      ...(a.needs_photo ? {} : { act: { assignmentId: a.id } }),
      tag: `john:${a.id}`,
    });
    sent += 1;
  }
  return sent;
}
