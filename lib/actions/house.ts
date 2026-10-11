"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { CATEGORIES, CURRENCIES, type IsoDow } from "@/lib/domain";
import { dealWeek, loadHouse } from "@/lib/engine/tick";
import { humanError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { weekIndex, weekWindow } from "@/lib/week";

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

const CreateHouse = z.object({
  name: z.string().trim().min(1, "Give the house a name.").max(60),
  timezone: z.string().min(1),
  currency: z.enum(CURRENCIES),
  weekStarts: z.coerce.number().int().min(1).max(7),
});

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
  const { error } = await supabase.rpc("join_house", { p_code: code });
  if (error) return { error: humanError(error) };
  redirect("/today");
}

const Settings = z.object({
  name: z.string().trim().min(1).max(60),
  timezone: z.string().min(1),
  currency: z.enum(CURRENCIES),
  weekStarts: z.coerce.number().int().min(1).max(7),
  stakeMinor: z.coerce.number().int().min(0).max(100000),
  lateForfeitMinor: z.coerce.number().int().min(0).max(100000),
  missedForfeitMinor: z.coerce.number().int().min(0).max(100000),
  disputeHours: z.coerce.number().int().min(0).max(72),
});

export async function updateHouse(input: z.input<typeof Settings>): Promise<Outcome> {
  const parsed = Settings.safeParse(input);
  if (!parsed.success) return { error: "Check the settings and try again." };
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
    })
    .eq("id", ctx.house.id);
  if (error) return { error: humanError(error) };
  refresh();
}

/**
 * Hand out this week's Johns. The first time, it starts the rota; after
 * that it re-deals the week, which deal_week only allows while nothing in it
 * has been ticked (someone new moved in, a John was added).
 */
export async function dealThisWeek(): Promise<Outcome> {
  const ctx = await myHouse();
  if (!ctx?.isAdmin) return { error: humanError({ message: "admins_only" }) };
  const admin = createAdminClient();
  const now = new Date();
  const { house, members } = await loadHouse(admin, ctx.house.id);
  const week = weekWindow(now, house.timezone, house.week_starts as IsoDow);
  try {
    const { weekId } = await dealWeek(admin, house, members, week, now, true);
    if (!weekId) return { error: "Add at least one John first." };
  } catch (e) {
    return { error: humanError({ message: e instanceof Error ? e.message : String(e) }) };
  }
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

const JohnInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name the John.").max(60),
  category: z.enum(CATEGORIES),
  points: z.coerce.number().int().min(1).max(10),
  everyWeeks: z.coerce.number().int().min(1).max(4),
  dueDow: z.coerce.number().int().min(1).max(7),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/),
  needsPhoto: z.boolean(),
});

export async function saveJohn(input: z.input<typeof JohnInput>): Promise<Outcome> {
  const parsed = JohnInput.safeParse(input);
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

export async function renameMe(name: string): Promise<Outcome> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 60) return { error: "Names are 1 to 60 characters." };
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
