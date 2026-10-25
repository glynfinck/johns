import { SIGN_IN } from '@app/core';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { RefreshCwIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Body, Heading } from '@/components/text';
import { QueryProvider } from '@/hooks/query';
import { MembershipProvider, useMembership } from '@/hooks/use-membership';
import { FONT_FILES, SPACE, useTheme } from '@/theme';

// Keep the splash up until Overpass has loaded and the saved session (and its
// house) has been read, so no screen shows the system font first, or the
// wrong screen to someone already signed in.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <QueryProvider>
      <MembershipProvider>
        <Routes />
      </MembershipProvider>
    </QueryProvider>
  );
}

function Routes() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const { session, house, loading, failed, refresh } = useMembership();
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
  if (failed) return <Unreachable onRetry={refresh} />;

  const signedIn = session !== null;
  const housed = house !== null;
  // Where each guard sends you when its screens aren't yours: signed out to
  // sign-in, as on the web; signed in to your house, or to starting one.
  const home = !signedIn ? SIGN_IN : housed ? '/today' : '/welcome';
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        {/* Signed out: the front door and sign-in. */}
        <Stack.Protected guard={!signedIn} redirectTo={home}>
          <Stack.Screen name="index" />
          <Stack.Screen name="signin" />
        </Stack.Protected>
        {/* Signed in, in no house: start one, or join by code. */}
        <Stack.Protected guard={signedIn && !housed} redirectTo={home}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="house/new" />
        </Stack.Protected>
        {/* In a house: its screens, as tabs. */}
        <Stack.Protected guard={signedIn && housed} redirectTo={home}>
          <Stack.Screen name="(house)" />
        </Stack.Protected>
        {/* A join link opens for anyone, and signs you in in place. */}
        <Stack.Screen name="join/[joinCode]" />
      </Stack>
    </>
  );
}

/** The house couldn't be read, so no screen can be chosen yet. */
function Unreachable({ onRetry }: { onRetry: () => Promise<void> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.unreachable, { backgroundColor: colors.background }]}>
      <Heading level={2}>Can’t reach your house</Heading>
      <Body muted>Check the connection, then try again.</Body>
      <Button label="Try again" icon={RefreshCwIcon} onPress={() => void onRetry()} />
    </View>
  );
}

const styles = StyleSheet.create({
  unreachable: { flex: 1, justifyContent: 'center', padding: SPACE.xl, gap: SPACE.lg },
});
