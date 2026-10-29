import type { Session } from '@supabase/supabase-js';

import { signOutOfGoogle } from './google';
import { ON_STAGING, rememberStagingPassword } from './staging';
import { supabase } from './supabase';

// All sign-in goes through this file: Google and Microsoft everywhere, and
// Sign in with Apple on iOS (App Store guideline 4.8). On iOS and Android,
// Google and Apple are native sheets whose ID token Supabase turns into a
// session, and Microsoft is the system's sign-in browser; the web build signs
// in with Google or Microsoft through Supabase's redirect, as jonz.app does.

/** How a sign-in attempt ended. `redirected`: the web has left for Google or Microsoft. */
export type SignInResult = 'signed-in' | 'cancelled' | 'redirected';

export { signInWithGoogle } from './google';
export { signInWithMicrosoft } from './microsoft';
export { appleSignInAvailable, signInWithApple } from './apple';

/**
 * Staging only: signs in as one of the demo house's housemates
 * (DEMO_HOUSEMATES), with the password staging's seed gave them all, and
 * remembers it once it worked. Throws when it's wrong, or this isn't staging.
 */
export async function signInAsDemo(email: string, password: string): Promise<void> {
  if (!ON_STAGING) throw new Error('Demo housemates only live on staging.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  rememberStagingPassword(password);
}

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
