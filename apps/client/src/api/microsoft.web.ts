import { SIGN_IN } from '@app/core';

import type { SignInResult } from './auth';
import { supabase } from './supabase';

// The web build: Microsoft through Supabase's redirect, as Google is
// (google.web.ts). Supabase calls the provider "azure"; it takes personal
// Outlook and Hotmail accounts as well as work and school ones.

/** `returnTo`: the path Microsoft sends the browser back to, sign-in itself unless a join link asked. */
export async function signInWithMicrosoft(returnTo: string = SIGN_IN): Promise<SignInResult> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: { redirectTo: `${window.location.origin}${returnTo}`, scopes: 'email' },
  });
  if (error) throw error;
  // The browser is already on its way to Microsoft.
  return 'redirected';
}
