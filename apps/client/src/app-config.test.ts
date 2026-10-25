import type { ExpoConfig } from 'expo/config';

import appConfig, { googleIosUrlScheme } from '../app.config';
import app from '../app.json';

const base = app.expo as unknown as ExpoConfig;

describe('googleIosUrlScheme', () => {
  it("turns the iOS client ID back to front, as Google's sign-in expects", () => {
    expect(googleIosUrlScheme('123-abc.apps.googleusercontent.com')).toBe('com.googleusercontent.apps.123-abc');
    expect(googleIosUrlScheme('  123-abc.apps.googleusercontent.com\n')).toBe('com.googleusercontent.apps.123-abc');
  });

  it('refuses anything that is not an iOS client ID', () => {
    expect(() => googleIosUrlScheme('')).toThrow('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
    expect(() => googleIosUrlScheme('.apps.googleusercontent.com')).toThrow();
    expect(() => googleIosUrlScheme('com.googleusercontent.apps.123-abc')).toThrow();
  });
});

describe('app.config.ts', () => {
  const saved = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  afterEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = saved;
  });

  it('leaves app.json as it is without an iOS client', () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    expect(appConfig({ config: base } as never)).toEqual(base);
  });

  it("adds Google's sign-in plugin with the iOS client's URL scheme", () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = '123-abc.apps.googleusercontent.com';
    const config = appConfig({ config: base } as never);
    expect(config.plugins).toEqual([
      ...(base.plugins ?? []),
      ['@react-native-google-signin/google-signin', { iosUrlScheme: 'com.googleusercontent.apps.123-abc' }],
    ]);
    expect(config.ios).toEqual(base.ios);
  });

  it('turns on Sign in with Apple for iOS', () => {
    expect(base.ios?.usesAppleSignIn).toBe(true);
    expect(base.plugins).toContain('expo-apple-authentication');
  });
});
