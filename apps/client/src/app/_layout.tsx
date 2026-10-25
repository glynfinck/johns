import { SIGN_IN } from '@app/core';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';

import { useSession } from '@/hooks/use-session';
import { FONT_FILES, useTheme } from '@/theme';

// Keep the splash up until Overpass has loaded and the saved session has been
// read, so no screen shows the system font first, or the front door to
// someone who is signed in.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const { session, loading } = useSession();
  const { scheme, colors } = useTheme();
  // A font that fails to load falls back to the system font rather than a stuck splash.
  const ready = (fontsLoaded || fontError !== null) && !loading;

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const signedIn = session !== null;
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        {/* Signed out: the front door and sign-in. Signing in moves on to Today. */}
        <Stack.Protected guard={!signedIn} redirectTo="/today">
          <Stack.Screen name="index" />
          <Stack.Screen name="signin" />
        </Stack.Protected>
        {/* Signed in. Signing out goes back to sign-in, as on the web. */}
        <Stack.Protected guard={signedIn} redirectTo={SIGN_IN}>
          <Stack.Screen name="today" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
