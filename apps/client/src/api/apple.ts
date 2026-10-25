import { nameFromParts } from '@app/core';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

import type { SignInResult } from './auth';
import { appleNonce } from './nonce';
import { setMyName } from './profile';
import { supabase } from './supabase';

// Sign in with Apple, offered on iOS only: App Store guideline 4.8 asks for it
// beside Google there, and nowhere else.

/** True on an iOS device that can show Apple's sheet. */
export async function appleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

function isCancel(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED';
}

export async function signInWithApple(): Promise<SignInResult> {
  const nonce = await appleNonce();
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: nonce.hashed,
    });
  } catch (error) {
    if (isCancel(error)) return 'cancelled';
    throw error;
  }
  if (!credential.identityToken) throw new Error('Apple sent no identity token.');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: nonce.raw,
  });
  if (error) throw error;

  // Apple sends the name once, on the first sign-in, and never in the token,
  // so the new profile was named after the (often relay) email address. Keep
  // the real one now or never. Failing to is no reason to fail the sign-in:
  // housemates can rename themselves.
  const name = nameFromParts([
    credential.fullName?.givenName,
    credential.fullName?.middleName,
    credential.fullName?.familyName,
  ]);
  if (name && data.user) {
    await setMyName(data.user.id, name).catch((nameError: unknown) => {
      console.warn('Signed in with Apple, but could not keep the name it sent', nameError);
    });
  }
  return 'signed-in';
}
