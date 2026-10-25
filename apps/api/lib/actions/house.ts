"use server";

import {
  CreateHouse,
  DisplayName,
  GroupDraft,
  HouseSettings,
  humanError,
  JohnDraft,
  JoinCode,
  RULES_COPY,
  weekIndex,
  weekWindow,
  type IsoDow,
} from "@app/core";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import * as moves from "@/lib/moves/deal";
import { createClient } from "@/lib/supabase/server";

export type Outcome = { error?: string } | void;

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** The caller's house, read through their own session: RLS decides. */
async function myHouse() {
  const { supabase, user } = await session();
  if (!user) return null;
  const { data } = await supabase
    .from("members")
    .select("house_id, role, houses(*)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data?.houses) return null;
  return { supabase, user, house: data.houses, isAdmin: data.role === "admin" };
}

export async function createHouse(input: z.input<typeof CreateHouse>): Promise<Outcome> {
  const parsed = CreateHouse.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await session();
  if (!user) redirect("/signin?next=/house/new");
  const { error } = await supabase.rpc("create_house", {
    p_name: parsed.data.name,
    p_timezone: parsed.data.timezone,
    p_currency: parsed.data.currency,
    p_week_starts: parsed.data.weekStarts,
  });
  if (error) return { error: humanError(error) };
  redirect("/house");
}

export async function joinHouse(code: string): Promise<Outcome> {
  const { supabase, user } = await session();
  if (!user) redirect(`/signin?next=/join/${encodeURIComponent(code)}`);
  const parsed = JoinCode.safeParse(code);
  if (!parsed.success) return { error: humanError({ message: "unknown_code" }) };
  const { error } = await supabase.rpc("join_house", { p_code: parsed.data });
  if (error) return { error: humanError(error) };
  redirect("/today");
}

export async function updateHouse(input: z.input<typeof HouseSettings>): Promise<Outcome> {
  const parsed = HouseSettings.safeParse(input);
  if (!parsed.success) return { error: RULES_COPY.check };
  const ctx = await myHouse();
  if (!ctx?.isAdmin) return { error: humanError({ message: "admins_only" }) };
  const s = parsed.data;
  const { error } = await ctx.supabase
    .from("houses")
    .update({
      name: s.name,
      timezone: s.timezone,
      currency: s.currency,
      week_starts: s.weekStarts,
      stake_minor: s.stakeMinor,
      late_forfeit_minor: s.lateForfeitMinor,
      missed_forfeit_minor: s.missedForfeitMinor,
      dispute_hours: s.disputeHours,
      away_makeup: s.awayMakeup,
    })
    .eq("id", ctx.house.id);
  if (error) return { error: humanError(error) };
  refresh();
}

/** Hand out this week's Johns, or re-deal it (lib/moves/deal.ts, shared with POST /api/deal). */
export async function dealThisWeek(): Promise<Outcome> {
  const ctx = await myHouse();
  if (!ctx) return { error: humanError({ message: "sign_in_required" }) };
  const refusal = await moves.dealThisWeek({ db: ctx.supabase, userId: ctx.user.id }, ctx.house.id, new Date());
  if (refusal) return { error: humanError(refusal) };
  refresh();
}

export async function setRole(userId: string, role: "admin" | "member"): Promise<Outcome> {
  const ctx = await myHouse();
  if (!ctx) return { error: humanError({ message: "sign_in_required" }) };
  const { error } = await ctx.supabase.rpc("set_member_role", {
    p_house: ctx.house.id,
    p_user: userId,
    p_role: role,
  });
  if (error) return { error: humanError(error) };
  refresh();
}

export async function removeMember(userId: string): Promise<Outcome> {
  const ctx = await myHouse();
  if (!ctx) return { error: humanError({ message: "sign_in_required" }) };
  const { error } = await ctx.supabase.rpc("remove_member", { p_house: ctx.house.id, p_user: userId });
  if (error) return { error: humanError(error) };
  if (userId === ctx.user.id) redirect("/house/new");
  refresh();
}

export async function saveJohn(input: z.input<typeof JohnDraft>): Promise<Outcome> {
  const parsed = JohnDraft.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await myHouse();
  if (!ctx?.isAdmin) return { error: humanError({ message: "admins_only" }) };
  const j = parsed.data;
  const fields = {
    name: j.name,
    category: j.category,
    points: j.points,
    every_weeks: j.everyWeeks,
    due_dow: j.dueDow,
    due_time: j.dueTime,
    needs_photo: j.needsPhoto,
    group_id: j.groupId,
  };
  const { error } = j.id
    ? await ctx.supabase.from("johns").update(fields).eq("id", j.id).eq("house_id", ctx.house.id)
    : await ctx.supabase.from("johns").insert({
        ...fields,
        house_id: ctx.house.id,
        anchor_week: weekIndex(weekWindow(new Date(), ctx.house.timezone, ctx.house.week_starts as IsoDow).startsOn),
      });
  if (error) return { error: humanError(error) };
  refresh();
}

export async function archiveJohn(id: string): Promise<Outcome> {
  const ctx = await myHouse();
  if (!ctx?.isAdmin) return { error: humanError({ message: "admins_only" }) };
  const { error } = await ctx.supabase
    .from("johns")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("house_id", ctx.house.id);
  if (error) return { error: humanError(error) };
  refresh();
}

/** Create or rewrite a group: who shares a bathroom, a floor, a fridge. */
export async function saveGroup(input: z.input<typeof GroupDraft>): Promise<Outcome> {
  const parsed = GroupDraft.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await myHouse();
  if (!ctx) return { error: humanError({ message: "sign_in_required" }) };
  const g = parsed.data;
  const { error } = await ctx.supabase.rpc("save_group", {
    p_house: ctx.house.id,
    p_group: (g.id ?? null) as string,
    p_name: g.name,
    p_members: g.members,
  });
  if (error) return { error: humanError(error) };
  refresh();
}

export async function deleteGroup(id: string): Promise<Outcome> {
  const ctx = await myHouse();
  if (!ctx) return { error: humanError({ message: "sign_in_required" }) };
  const { error } = await ctx.supabase.rpc("delete_group", { p_group: id });
  if (error) return { error: humanError(error) };
  refresh();
}

export async function renameMe(name: string): Promise<Outcome> {
  const parsed = DisplayName.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const trimmed = parsed.data;
  const { supabase, user } = await session();
  if (!user) return { error: humanError({ message: "sign_in_required" }) };
  const { error } = await supabase.from("profiles").update({ display_name: trimmed }).eq("id", user.id);
  if (error) return { error: humanError(error) };
  refresh();
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/signin");
}
