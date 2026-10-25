import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import type { SignInResult } from './auth';
import { supabase } from './supabase';

// iOS and Android: Google's own sign-in sheet hands back an ID token, which
// Supabase turns into a session. No browser, no redirect. The web build uses
// google.web.ts instead.

let configured = false;

function configure(): void {
  if (configured) return;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!webClientId) throw new Error('Google sign-in needs EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env.local.');
  if (Platform.OS === 'ios' && !iosClientId) {
    throw new Error('Google sign-in on iOS needs EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in .env.local.');
  }
  // The web client is the token's audience on Android; iOS signs with its own.
  GoogleSignin.configure({ webClientId, iosClientId });
  configured = true;
}

export async function signInWithGoogle(): Promise<SignInResult> {
  configure();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return 'cancelled';
    const token = response.data.idToken;
    if (!token) throw new Error('Google sent no ID token.');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
    if (error) throw error;
    return 'signed-in';
  } catch (error) {
    // Closing the sheet, or a second tap while it's open, isn't a failure.
    if (isErrorWithCode(error) && (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS)) {
      return 'cancelled';
    }
    throw error;
  }
}

/**
 * Forget the Google account on this device too, so the next sign-in asks
 * which account. Best effort: the Supabase session is what signs you out.
 */
export async function signOutOfGoogle(): Promise<void> {
  try {
    configure();
    await GoogleSignin.signOut();
  } catch {
    // Not configured in this build, or never signed in with Google.
  }
}
