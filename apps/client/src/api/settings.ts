import {
  HouseSettings,
  humanError,
  JohnDraft,
  johnDef,
  MoveResponse,
  RULES_COPY,
  weekIndex,
  weekWindow,
  type HouseRules,
  type JohnDef,
} from '@app/core';

import { apiPost } from './http';
import { supabase } from './supabase';

// House: the John list, the house rules and who lives here, read and written
// through your own session. Admins write the list and the rules through the
// columns granted to them; roles and leaving go through set_member_role and
// remove_member; the deal needs the server (POST /api/deal). RLS and those
// functions decide; this only translates. (Renaming yourself is profile.ts.)

/** A group a John can belong to, for the editor's "Shared by". */
export interface GroupOption {
  id: string;
  name: string;
}

export interface JohnList {
  johns: JohnDef[];
  groups: GroupOption[];
}

/** The house's list of Johns, oldest first, and its groups. */
export async function loadJohnList(houseId: string): Promise<JohnList> {
  const [johns, groups] = await Promise.all([
    supabase
      .from('johns')
      .select('id, name, category, points, every_weeks, due_dow, due_time, needs_photo, group_id')
      .eq('house_id', houseId)
      .is('archived_at', null)
      .order('created_at'),
    supabase.from('groups').select('id, name').eq('house_id', houseId).order('name'),
  ]);
  if (johns.error) throw johns.error;
  if (groups.error) throw groups.error;
  return { johns: (johns.data ?? []).map(johnDef), groups: groups.data ?? [] };
}

/**
 * RLS lets only an admin's write through, and filters anyone else's to no
 * rows rather than refusing it, so a write that reached nothing wasn't
 * theirs to make.
 */
function wrote(result: { data: unknown[] | null; error: { message?: string; code?: string } | null }) {
  if (result.error) throw new Error(humanError(result.error));
  if (!result.data?.length) throw new Error(humanError({ message: 'admins_only' }));
}

/**
 * Add a John, or change one. A new John's cadence counts from the house's
 * current week, as the web's does. Changes apply from the next deal.
 */
export async function saveJohn(houseId: string, rules: HouseRules, draft: Omit<JohnDraft, 'id'> & { id?: string }, now: Date) {
  const parsed = JohnDraft.safeParse(draft);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
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
  wrote(
    j.id
      ? await supabase.from('johns').update(fields).eq('id', j.id).eq('house_id', houseId).select('id')
      : await supabase
          .from('johns')
          .insert({
            ...fields,
            house_id: houseId,
            anchor_week: weekIndex(weekWindow(now, rules.timezone, rules.weekStarts).startsOn),
          })
          .select('id'),
  );
}

/** Take a John off the list. Weeks already dealt keep it; the next deal won't. */
export async function archiveJohn(houseId: string, johnId: string, now: Date) {
  wrote(
    await supabase
      .from('johns')
      .update({ archived_at: now.toISOString() })
      .eq('id', johnId)
      .eq('house_id', houseId)
      .select('id'),
  );
}

/** The house rules, as an admin set them. */
export async function updateHouse(houseId: string, settings: HouseSettings) {
  const parsed = HouseSettings.safeParse(settings);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? RULES_COPY.check);
  const s = parsed.data;
  wrote(
    await supabase
      .from('houses')
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
      .eq('id', houseId)
      .select('id'),
  );
}

/** Make a housemate an admin, or an admin a housemate. A house always keeps one admin. */
export async function setRole(houseId: string, userId: string, role: 'admin' | 'member') {
  const { error } = await supabase.rpc('set_member_role', { p_house: houseId, p_user: userId, p_role: role });
  if (error) throw new Error(humanError(error));
}

/** Ask someone to leave (admins), or leave yourself (anyone). */
export async function removeMember(houseId: string, userId: string) {
  const { error } = await supabase.rpc('remove_member', { p_house: houseId, p_user: userId });
  if (error) throw new Error(humanError(error));
}

/** Hand out this week's Johns, or re-deal a week nobody has ticked in: admins only (the server checks). */
export async function dealThisWeek(houseId: string) {
  await apiPost('/api/deal', { houseId }, MoveResponse);
}
