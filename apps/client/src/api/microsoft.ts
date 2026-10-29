import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import type { SignInResult } from './auth';
import { supabase } from './supabase';

// iOS and Android: Microsoft has no native sheet that hands Supabase a token,
// so sign-in runs in the system's sign-in browser (ASWebAuthenticationSession
// on iOS, a Custom Tab on Android). Supabase sends it back to the app's own
// address with the session in the fragment, and the app keeps that session.
// The web build uses microsoft.web.ts instead.

/** Where Supabase sends the browser back to: the app's scheme, jonz://signin. */
export function microsoftReturn(): string {
  return Linking.createURL('signin');
}

/** The session's tokens, or the error, from the address the browser came back to. */
export function sessionFromReturn(url: string): { accessToken: string; refreshToken: string } | { error: string } {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  for (const [key, value] of parsed.searchParams) if (!params.has(key)) params.set(key, value);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { accessToken, refreshToken };
  return { error: params.get('error_description') ?? params.get('error') ?? 'Microsoft sent no session.' };
}

/** `returnTo` is the web's (microsoft.web.ts): the app always comes back to itself. */
export async function signInWithMicrosoft(returnTo?: string): Promise<SignInResult> {
  void returnTo;
  const redirectTo = microsoftReturn();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: { redirectTo, scopes: 'email', skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Supabase sent no Microsoft address.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return 'cancelled';

  const session = sessionFromReturn(result.url);
  if ('error' in session) throw new Error(session.error);
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });
  if (sessionError) throw sessionError;
  return 'signed-in';
}
