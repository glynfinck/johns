import { SIGN_IN } from '@app/core';

import type { SignInResult } from './auth';
import { supabase } from './supabase';

// The web build: Google through Supabase's redirect, as johns.glyn.dev does.
// The browser comes back to /signin with a code, and supabase-js finishes the
// PKCE exchange in the page (detectSessionInUrl), so no callback route is needed.

export async function signInWithGoogle(): Promise<SignInResult> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${SIGN_IN}` },
  });
  if (error) throw error;
  // The browser is already on its way to Google.
  return 'redirected';
}

/** Nothing to forget: the web keeps no Google account of its own. */
export async function signOutOfGoogle(): Promise<void> {}
