import {
  passOf,
  weekWindow,
  rulesOf,
  type AssignmentRow,
  type DisputeRow,
  type HousePass,
  type HouseRules,
  type OnCallRow,
  type WeekRow,
} from '@app/core';

import { supabase } from './supabase';

// Everything a house screen shows, read through your own session (RLS
// decides), as rows. Screens build the week from them with core's
// buildWeekBoard at the moment they render, so statuses move on with the
// clock between reads.

export interface Housemate {
  userId: string;
  name: string;
  role: 'admin' | 'member';
  streak: number;
  immunityTokens: number;
  swapTokens: number;
}

export interface HouseSnapshot {
  house: {
    id: string;
    name: string;
    joinCode: string;
    everDealt: boolean;
    awayMakeup: number;
    /** The House Pass: who has the extras, and until when. */
    pass: HousePass;
  };
  rules: HouseRules;
  members: Housemate[];
  week: WeekRow | null;
  /** This week's Johns, and any flag from last week still open (it stays its holder's). */
  assignments: AssignmentRow[];
  disputes: DisputeRow[];
  /** Who is on call for each on-call John this week. */
  onCall: OnCallRow[];
}

/** One read of a house: its rules and people, and this week's Johns and disputes. */
export async function loadHouse(houseId: string, now: Date): Promise<HouseSnapshot> {
  const [{ data: house, error: houseError }, { data: members, error: membersError }] = await Promise.all([
    supabase.from('houses').select('*').eq('id', houseId).single(),
    supabase
      .from('members')
      .select('user_id, role, streak, immunity_tokens, swap_tokens, profiles(display_name)')
      .eq('house_id', houseId)
      .order('joined_at'),
  ]);
  if (houseError) throw houseError;
  if (membersError) throw membersError;

  const rules = rulesOf(house);
  const window = weekWindow(now, rules.timezone, rules.weekStarts);
  const { data: week, error: weekError } = await supabase
    .from('weeks')
    .select('id, starts_on, starts_at, ends_at')
    .eq('house_id', houseId)
    .eq('starts_on', window.startsOn)
    .maybeSingle();
  if (weekError) throw weekError;

  const [assignments, carried, disputes, onCall] = week
    ? await Promise.all([
        // With how often each comes round, from the John it was dealt from (the John sheet says so).
        supabase.from('assignments').select('*, johns(every_weeks)').eq('week_id', week.id).order('due_at'),
        // A flag raised late last week can still be open: it stays with whoever had it.
        supabase
          .from('assignments')
          .select('*, johns(every_weeks)')
          .eq('house_id', houseId)
          .neq('week_id', week.id)
          .not('flagged_at', 'is', null)
          .is('outcome', null),
        supabase
          .from('disputes')
          .select('id, assignment_id, raised_by, reason, closes_at, dispute_votes(user_id, uphold)')
          .eq('house_id', houseId)
          .is('resolution', null),
        supabase.from('on_call').select('john_id, user_id, johns(name, category, needs_photo, archived_at)').eq('week_id', week.id),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (assignments.error) throw assignments.error;
  if (carried.error) throw carried.error;
  if (disputes.error) throw disputes.error;
  if (onCall.error) throw onCall.error;

  return {
    house: {
      id: house.id,
      name: house.name,
      joinCode: house.join_code,
      everDealt: house.first_dealt_at !== null,
      awayMakeup: house.away_makeup,
      pass: passOf(house),
    },
    rules,
    members: (members ?? []).map((m) => ({
      userId: m.user_id,
      name: m.profiles?.display_name ?? 'Housemate',
      role: m.role as Housemate['role'],
      streak: m.streak,
      immunityTokens: m.immunity_tokens,
      swapTokens: m.swap_tokens,
    })),
    week: week ?? null,
    assignments: [...(assignments.data ?? []), ...(carried.data ?? [])],
    disputes: disputes.data ?? [],
    onCall: onCall.data ?? [],
  };
}
