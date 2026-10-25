import { SIGN_IN_COPY } from '@app/core';
import { useFocusEffect } from 'expo-router';
import { LogOutIcon } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signOut } from '@/api/auth';
import { catchUp } from '@/api/house';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Body, Eyebrow, Heading } from '@/components/text';
import { Wordmark } from '@/components/wordmark';
import { useMembership } from '@/hooks/use-membership';
import { useMyName } from '@/hooks/use-my-name';
import { SITE_URL } from '@/links';
import { SPACE, useTheme } from '@/theme';

/**
 * Your house, signed in. For now it names the house and who you are, and
 * catches the house up whenever it comes into view, as a web page load does;
 * the real Today arrives in Phase 6 of docs/specs/native-migration.md.
 */
export default function Today() {
  const { colors } = useTheme();
  const { session, house } = useMembership();
  const name = useMyName(session?.user.id);
  const [leaving, setLeaving] = useState(false);
  const houseId = house?.id;

  useFocusEffect(
    useCallback(() => {
      // The server ticks at most once a minute per house; a failure only
      // means the next look is a little out of date.
      if (houseId) catchUp(houseId).catch((reason: unknown) => console.warn('Catching up failed', reason));
    }, [houseId]),
  );

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
          <Eyebrow>{name ? `Signed in as ${name}` : ' '}</Eyebrow>
          <Heading style={styles.name}>{house?.name ?? ' '}</Heading>
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
