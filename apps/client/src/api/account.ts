import { humanError, previewFromRow, statusFromRow, type DeletionPreview, type DeletionStatus } from '@app/core';

import { supabase } from './supabase';

// Deleting your account (supabase/migrations/*_delete_account.sql): asked
// for here, it waits 30 days, in which Keep my account stops it. Everything
// goes through your own session; the clock does the rest.

/** What the Delete sheet says: your house, until when a Pass you pay for lasts, and the day it would go. */
export async function deletionPreview(): Promise<DeletionPreview> {
  const { data, error } = await supabase.rpc('account_deletion_preview');
  if (error) throw new Error(humanError(error));
  return previewFromRow(data);
}

/**
 * Starts the 30 days, and signs you out everywhere else: on this device the
 * being-deleted screen says when it goes. Says when.
 */
export async function requestDeletion(): Promise<string> {
  const { data, error } = await supabase.rpc('request_account_deletion');
  if (error) throw new Error(humanError(error));
  // Other phones and laptops signed in as you: signed out, so nobody carries on there.
  await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined);
  return data;
}

/** Keep my account: the 30 days stop. */
export async function keepAccount(): Promise<void> {
  const { error } = await supabase.rpc('keep_account');
  if (error) throw new Error(humanError(error));
}

/** Yours while it waits; null when your account isn't being deleted. */
export async function deletionStatus(): Promise<DeletionStatus | null> {
  const { data, error } = await supabase.rpc('account_deletion_status');
  if (error) throw new Error(humanError(error));
  return statusFromRow(data);
}
