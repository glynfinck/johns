import {
  ChatResponse,
  draftPlan,
  offlineTurn,
  type ChatMessage,
  type GroupDef,
  type HouseDraft,
  type HouseRules,
} from '@app/core';

import { apiPost, ApiRequestError } from './http';
import { addJohns, saveGroup } from './settings';
import { supabase } from './supabase';

// Describe your house: one turn of the setup chat with apps/api (Claude, or
// a starter list when Claude isn't there), then add the Johns an admin kept.
// Keeping goes through the John list's own grants and save_group, exactly as
// adding Johns and groups by hand does; the draft itself is never stored.

/**
 * Jonz's answer to the chat so far, with the draft as it stands. A refusal
 * (not an admin, too many turns today) throws its sentence; if the API
 * can't be reached at all, offlineTurn answers here as the API would
 * (a starter list that fits, or the draft left as it is), so setting up a
 * house never stops here.
 */
export async function sendChat(houseId: string, messages: readonly ChatMessage[], draft: HouseDraft | null): Promise<ChatResponse> {
  try {
    return await apiPost('/api/setup/draft', { houseId, messages, draft }, ChatResponse);
  } catch (e) {
    if (e instanceof ApiRequestError && e.status >= 400 && e.status < 500 && e.status !== 404) throw e;
    return offlineTurn(messages, draft);
  }
}

/**
 * Add the kept Johns (by their place in the draft) to the house's list,
 * making the groups they need first. Returns how many were added.
 */
export async function keepDraft(
  houseId: string,
  rules: HouseRules,
  draft: HouseDraft,
  keep: readonly number[],
  groups: readonly GroupDef[],
  now: Date,
): Promise<number> {
  const plan = draftPlan(draft, keep, groups);
  for (const group of plan.makeGroups) await saveGroup(houseId, group);
  let ids = new Map(groups.map((g) => [g.name, g.id]));
  if (plan.makeGroups.length > 0) {
    const { data, error } = await supabase.from('groups').select('id, name').eq('house_id', houseId);
    if (error) throw error;
    ids = new Map((data ?? []).map((g) => [g.name, g.id]));
  }
  await addJohns(
    houseId,
    rules,
    plan.johns.map(({ john, groupName }) => ({ ...john, groupId: groupName ? (ids.get(groupName) ?? null) : null })),
    now,
  );
  return plan.johns.length;
}
