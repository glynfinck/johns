import { SIGN_IN_COPY } from '@app/core';
import { LogOutIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signOut } from '@/api/auth';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Body, Eyebrow, Heading } from '@/components/text';
import { Wordmark } from '@/components/wordmark';
import { useMyName } from '@/hooks/use-my-name';
import { useSession } from '@/hooks/use-session';
import { SITE_URL } from '@/links';
import { SPACE, useTheme } from '@/theme';

/**
 * Signed in. For now this only says who you are and lets you out: joining or
 * starting a house arrives in Phase 5 of docs/specs/native-migration.md, and
 * the real Today in Phase 6.
 */
export default function Today() {
  const { colors } = useTheme();
  const { session } = useSession();
  const name = useMyName(session?.user.id);
  const [leaving, setLeaving] = useState(false);

  async function leave() {
    setLeaving(true);
    try {
      await signOut();
    } catch (reason) {
      // The guard moves on once the session is gone; anything else, try again.
      console.warn('Sign out failed', reason);
      setLeaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.page}>
        <Wordmark />
        <Card>
          <Eyebrow>Signed in</Eyebrow>
          <Heading style={styles.name}>{name ?? ' '}</Heading>
          <Body muted style={styles.body}>
            {`Your house's Johns are on their way to the app. Until then, play them at ${SITE_URL.replace('https://', '')}.`}
          </Body>
        </Card>
        <View style={styles.actions}>
          <Button
            variant="outline"
            icon={LogOutIcon}
            label={SIGN_IN_COPY.signOut}
            disabled={leaving}
            onPress={() => void leave()}
            testID="sign-out"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 1024, alignSelf: 'center', padding: SPACE.xl, gap: SPACE.xl },
  name: { marginTop: SPACE.sm },
  body: { marginTop: SPACE.md },
  actions: { alignItems: 'flex-start' },
});
