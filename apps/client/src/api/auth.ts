import type { Session } from '@supabase/supabase-js';

import { supabase } from './supabase';

// All sign-in goes through this file. Johns signs in with Google everywhere and
// Sign in with Apple on iOS (App Store guideline 4.8); both arrive in Phase 4 of
// docs/specs/native-migration.md, as Supabase ID-token sign-ins.

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getAccessToken(): Promise<string | null> {
  return (await getSession())?.access_token ?? null;
}

/** Calls back whenever the user signs in, signs out or the session refreshes. Returns an unsubscribe function. */
export function onSessionChange(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}
