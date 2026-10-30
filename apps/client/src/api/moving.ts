import { CreateHouse, humanError } from '@app/core';

import { supabase } from './supabase';

// Bring Jonz to your next house (docs/specs/moving-on.md): your moving-out
// date, and once you've left, starting your next house from the old list.
// The database decides each one; a refusal throws the sentence to show.

/** Say the day you move out (the house's local date), or null for staying after all. */
export async function setMovingOut(on: string | null) {
  const { error } = await supabase.rpc('set_moving_out', { p_on: on });
  if (error) throw new Error(humanError(error));
}

/** The house you left most recently, while it can still come with you: its name and how many Johns it has. */
export interface MovingOn {
  fromHouse: string;
  houseName: string;
  johns: number;
}

/** What the Moving on screen offers, or null when you haven't just left a house. */
export async function movingOn(): Promise<MovingOn | null> {
  const { data, error } = await supabase.rpc('moving_on');
  if (error) throw error;
  const row = data?.[0];
  return row ? { fromHouse: row.from_house, houseName: row.house_name, johns: Number(row.johns) } : null;
}

/** A new house with the John list of the one you left, with you as its admin. */
export async function startHouseFrom(fromHouse: string, input: CreateHouse): Promise<string> {
  const parsed = CreateHouse.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const { data, error } = await supabase.rpc('start_house_from', {
    p_from: fromHouse,
    p_name: parsed.data.name,
    p_timezone: parsed.data.timezone,
    p_currency: parsed.data.currency,
    p_week_starts: parsed.data.weekStarts,
  });
  if (error) throw new Error(humanError(error));
  return data;
}
