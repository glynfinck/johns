"use server";

import { AwayDraft, humanError } from "@app/core";
import { refresh } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Time away. Thin wrappers: set_away and cancel_away decide everything,
 * including pulling forward the Johns you already have.
 */

export type AwayOutcome = { error?: string; moved?: number } | void;

export async function setAway(input: z.input<typeof AwayDraft>): Promise<AwayOutcome> {
  const parsed = AwayDraft.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_away", {
    p_starts: parsed.data.from,
    p_ends: parsed.data.to,
    p_note: parsed.data.note || undefined,
  });
  if (error) return { error: humanError(error) };
  refresh();
  return { moved: data ?? 0 };
}

export async function cancelAway(id: string): Promise<AwayOutcome> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_away", { p_away: id });
  if (error) return { error: humanError(error) };
  refresh();
}
