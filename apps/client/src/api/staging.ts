import { authStorage } from './storage';

// Staging (staging.jonz.app and every preview of the web build) is the same
// app on a database of its own with a demo house in it. The build says which
// it is: EXPO_PUBLIC_STAGE=staging, set only in Vercel's Preview environment,
// so production never shows any of this. Signing in as a demo housemate is
// auth.ts's signInAsDemo.

export const ON_STAGING = process.env.EXPO_PUBLIC_STAGE === 'staging';

const PASSWORD_KEY = 'jonz.staging-password';

/** The staging password this device was last given, so it's typed once. */
export function savedStagingPassword(): string {
  try {
    return authStorage?.getItem(PASSWORD_KEY) ?? '';
  } catch {
    return '';
  }
}

export function rememberStagingPassword(password: string): void {
  try {
    authStorage?.setItem(PASSWORD_KEY, password);
  } catch {
    // Not remembered; it's asked for again next time.
  }
}
