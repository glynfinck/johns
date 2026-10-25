import type { ConfigContext, ExpoConfig } from 'expo/config';

const GOOGLE_CLIENT_SUFFIX = '.apps.googleusercontent.com';

/**
 * Google's iOS sign-in comes back to the app through a URL scheme that is the
 * iOS client ID back to front: `123-abc.apps.googleusercontent.com` becomes
 * `com.googleusercontent.apps.123-abc`.
 */
export function googleIosUrlScheme(iosClientId: string): string {
  const id = iosClientId.trim();
  if (!id.endsWith(GOOGLE_CLIENT_SUFFIX) || id.length === GOOGLE_CLIENT_SUFFIX.length) {
    throw new Error(`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID should end in ${GOOGLE_CLIENT_SUFFIX}, not "${id}"`);
  }
  return `com.googleusercontent.apps.${id.slice(0, -GOOGLE_CLIENT_SUFFIX.length)}`;
}

// app.json holds the app's settings. This adds the one it can't: Google's iOS
// URL scheme, made from the iOS client ID in the environment. The ID is public,
// but it only exists once the iOS client does in Google Cloud. Without it the
// app still builds; only Google sign-in on iOS is missing.
export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!iosClientId) return config as ExpoConfig;
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme(iosClientId) }],
    ],
  } as ExpoConfig;
};
