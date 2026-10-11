import "server-only";

import type { HouseContext } from "./house";

export interface Group {
  id: string;
  name: string;
  memberIds: string[];
}

/** The house's groups and who is in each, read through RLS. */
export async function getGroups(ctx: HouseContext): Promise<Group[]> {
  const { data } = await ctx.supabase
    .from("groups")
    .select("id, name, group_members(user_id)")
    .eq("house_id", ctx.house.id)
    .order("name");
  return (data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    memberIds: (g.group_members ?? []).map((m) => m.user_id),
  }));
}
