import type { Session } from '@supabase/supabase-js';

import { signOutOfGoogle } from './google';
import { supabase } from './supabase';

// All sign-in goes through this file: Google everywhere, and Sign in with
// Apple on iOS (App Store guideline 4.8). On iOS and Android both are native
// sheets whose ID token Supabase turns into a session; the web build signs in
// with Google through Supabase's redirect, as jonz.app does.

/** How a sign-in attempt ended. `redirected`: the web has left for Google. */
export type SignInResult = 'signed-in' | 'cancelled' | 'redirected';

export { signInWithGoogle } from './google';
export { appleSignInAvailable, signInWithApple } from './apple';

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  await signOutOfGoogle();
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
