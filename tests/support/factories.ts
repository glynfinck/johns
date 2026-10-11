import { expect } from "vitest";

import type { Category, IsoDow } from "@/lib/domain";
import { dealWeek, loadHouse } from "@/lib/engine/tick";
import { weekIndex, weekWindow, type WeekWindow } from "@/lib/week";

import { adminClient, signedInUser, type Actor } from "./clients";
import { track } from "./scope";

export const ZONE = "Europe/London";

export interface House {
  id: string;
  code: string;
  admin: Actor;
  members: Actor[];
  /** Everyone, admin first, in join order. */
  everyone: Actor[];
}

/** A house set up the way the app does it: create_house, then join_house by code. */
export async function makeHouse(names: string[] = ["Ava", "Ben", "Cal"]): Promise<House> {
  const [first, ...rest] = names;
  const admin = await signedInUser(first);
  const { data: id, error } = await admin.db.rpc("create_house", {
    p_name: `${first}'s house`,
    p_timezone: ZONE,
    p_currency: "GBP",
    p_week_starts: 1,
  });
  if (error) throw error;
  track.house(id!);
  const { data: house } = await adminClient().from("houses").select("join_code").eq("id", id!).single();
  const members: Actor[] = [];
  for (const name of rest) {
    const m = await signedInUser(name);
    const { error: joinError } = await m.db.rpc("join_house", { p_code: house!.join_code });
    if (joinError) throw joinError;
    members.push(m);
  }
  return { id: id!, code: house!.join_code, admin, members, everyone: [admin, ...members] };
}

export interface JohhSpec {
  name: string;
  points?: number;
  category?: Category;
  dueDow?: IsoDow;
  dueTime?: string;
  everyWeeks?: number;
  needsPhoto?: boolean;
}

export async function addJohhs(houseId: string, specs: JohhSpec[], anchor: WeekWindow) {
  const { data, error } = await adminClient()
    .from("johhs")
    .insert(
      specs.map((s) => ({
        house_id: houseId,
        name: s.name,
        points: s.points ?? 2,
        category: s.category ?? "other",
        due_dow: s.dueDow ?? 7,
        due_time: s.dueTime ?? "21:00",
        every_weeks: s.everyWeeks ?? 1,
        needs_photo: s.needsPhoto ?? false,
        anchor_week: weekIndex(anchor.startsOn),
      })),
    )
    .select("id, name");
  if (error) throw error;
  return data!;
}

/** Deal a week through the engine, as the clock would. */
export async function deal(houseId: string, week: WeekWindow, now: Date) {
  const db = adminClient();
  const { house, members } = await loadHouse(db, houseId);
  const { weekId } = await dealWeek(db, house, members, week, now, false);
  expect(weekId).toBeTruthy();
  const { data } = await db
    .from("assignments")
    .select("*")
    .eq("week_id", weekId!)
    .order("due_at");
  return { weekId: weekId!, assignments: data! };
}

/** The current real week, which is the only one the housemate functions will accept ticks in. */
export function thisWeek(now = new Date()) {
  return weekWindow(now, ZONE, 1);
}

/** A week safely in the past (the functions will refuse ticks in it). */
export function weeksAgo(n: number, now = new Date()) {
  return weekWindow(new Date(now.getTime() - n * 7 * 86_400_000), ZONE, 1);
}

/** Read a row back past RLS: the only honest proof a write was blocked. */
export async function reread<T extends string>(table: T, id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await adminClient().from(table as any).select("*").eq("id", id).single();
  return data as Record<string, unknown>;
}

export function actorFor(house: House, userId: string): Actor {
  return house.everyone.find((a) => a.userId === userId)!;
}

export function someoneElse(house: House, userId: string): Actor {
  return house.everyone.find((a) => a.userId !== userId)!;
}
