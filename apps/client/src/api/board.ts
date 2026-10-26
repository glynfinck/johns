import { weekWindow, rulesOf, type AssignmentRow, type DisputeRow, type HouseRules, type WeekRow } from '@app/core';

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
  };
  rules: HouseRules;
  members: Housemate[];
  week: WeekRow | null;
  assignments: AssignmentRow[];
  disputes: DisputeRow[];
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

  const [assignments, disputes] = week
    ? await Promise.all([
        // With how often each comes round, from the John it was dealt from (the John sheet says so).
        supabase.from('assignments').select('*, johns(every_weeks)').eq('week_id', week.id).order('due_at'),
        supabase
          .from('disputes')
          .select('id, assignment_id, raised_by, reason, closes_at, dispute_votes(user_id, uphold)')
          .eq('house_id', houseId)
          .is('resolution', null),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (assignments.error) throw assignments.error;
  if (disputes.error) throw disputes.error;

  return {
    house: {
      id: house.id,
      name: house.name,
      joinCode: house.join_code,
      everDealt: house.first_dealt_at !== null,
      awayMakeup: house.away_makeup,
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
    assignments: assignments.data ?? [],
    disputes: disputes.data ?? [],
  };
}
