import { PAGE_TITLE } from '@app/core';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageTitle } from '@/components/page-title';
import { SignInPanel } from '@/components/sign-in-panel';
import { SPACE, useTheme } from '@/theme';

/**
 * Sign in. Once a session exists the root layout's guard moves on by itself:
 * to Today, or to starting or joining a house.
 */
export default function SignIn() {
  const { colors } = useTheme();
  // The web build comes back here from Google; a failure arrives as ?error=.
  const { error } = useLocalSearchParams<{ error?: string }>();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <PageTitle page={PAGE_TITLE.signIn} />
      <ScrollView contentContainerStyle={styles.page}>
        <SignInPanel failed={Boolean(error)} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 384,
    alignSelf: 'center',
    justifyContent: 'center',
    padding: SPACE.xl,
  },
});
