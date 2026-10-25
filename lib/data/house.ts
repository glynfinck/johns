import "server-only";

import { SIGN_IN, type Database, type HouseRules } from "@app/core";
import { redirect } from "next/navigation";
import { cache } from "react";

import { ensureFresh } from "@/lib/engine/fresh";
import { rulesOf } from "@/lib/engine/tick";
import { createClient } from "@/lib/supabase/server";

export type HouseRow = Database["public"]["Tables"]["houses"]["Row"];

export interface Housemate {
  userId: string;
  name: string;
  role: "admin" | "member";
  joinedAt: string;
  streak: number;
  immunityTokens: number;
  swapTokens: number;
}

export interface HouseContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  house: HouseRow;
  rules: HouseRules;
  members: Housemate[];
  me: Housemate;
  isAdmin: boolean;
  /** The one clock reading the whole request agrees on. */
  now: Date;
}

/** The signed-in user, or null. One read per request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

/** The house the user belongs to, if any, read through their own session. */
export const getMembership = cache(async () => {
  const { supabase, user } = await getUser();
  if (!user) return { supabase, user: null, houseId: null };
  const { data } = await supabase.from("members").select("house_id").eq("user_id", user.id).maybeSingle();
  return { supabase, user, houseId: data?.house_id ?? null };
});

/**
 * Everything a house screen needs to know about who is looking. Sends a
 * signed-out visitor to sign in and a houseless one to set a house up.
 * Cached per request, so the layout and the page share one read.
 */
export const requireHouse = cache(async (): Promise<HouseContext> => {
  const { supabase, user, houseId } = await getMembership();
  if (!user) redirect(SIGN_IN);
  if (!houseId) redirect("/house/new");

  const now = new Date();
  const { data: before } = await supabase.from("houses").select("ticked_at").eq("id", houseId).single();
  await ensureFresh(houseId, before?.ticked_at ?? null, now);

  const [{ data: house }, { data: rows }] = await Promise.all([
    supabase.from("houses").select("*").eq("id", houseId).single(),
    supabase
      .from("members")
      .select("user_id, role, joined_at, streak, immunity_tokens, swap_tokens, profiles(display_name)")
      .eq("house_id", houseId)
      .order("joined_at"),
  ]);
  if (!house || !rows) redirect("/house/new");

  const members: Housemate[] = rows.map((r) => ({
    userId: r.user_id,
    name: r.profiles?.display_name ?? "Housemate",
    role: r.role as Housemate["role"],
    joinedAt: r.joined_at,
    streak: r.streak,
    immunityTokens: r.immunity_tokens,
    swapTokens: r.swap_tokens,
  }));
  const me = members.find((m) => m.userId === user.id)!;
  return {
    supabase,
    userId: user.id,
    house,
    rules: rulesOf(house),
    members,
    me,
    isAdmin: me.role === "admin",
    now,
  };
});

export function nameOf(ctx: Pick<HouseContext, "members" | "userId">, userId: string | null): string {
  if (!userId) return "Someone";
  if (userId === ctx.userId) return "You";
  return ctx.members.find((m) => m.userId === userId)?.name ?? "A former housemate";
}
