import "server-only";

import { groupDef, type GroupDef } from "@app/core";

import type { HouseContext } from "./house";

export type Group = GroupDef;

/** The house's groups and who is in each, read through RLS. */
export async function getGroups(ctx: HouseContext): Promise<Group[]> {
  const { data } = await ctx.supabase
    .from("groups")
    .select("id, name, group_members(user_id)")
    .eq("house_id", ctx.house.id)
    .order("name");
  return (data ?? []).map(groupDef);
}
