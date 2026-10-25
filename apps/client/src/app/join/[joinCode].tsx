import { JOIN_COPY } from '@app/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { houseByCode, joinHouse, type Invite } from '@/api/house';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { SignInPanel } from '@/components/sign-in-panel';
import { Body, Eyebrow, Heading } from '@/components/text';
import { Wordmark } from '@/components/wordmark';
import { useMembership } from '@/hooks/use-membership';
import { SPACE, useTheme } from '@/theme';

/**
 * A join link: /join/CODE on the web, johns://join/CODE on a phone, the same
 * path the web app's links use. Open to anyone, so the code survives signing
 * in: signed out, it signs you in here. Like the web, it names the house only
 * to someone signed in. (The parameter is `joinCode`, not `code`: the web's
 * Google redirect comes back with a `?code=` of its own.)
 */
export default function Join() {
  const { colors } = useTheme();
  const { joinCode } = useLocalSearchParams<{ joinCode: string }>();
  const { session, house, refresh } = useMembership();
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [joining, setJoining] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    houseByCode(joinCode)
      .then((found) => {
        if (active) setInvite(found);
      })
      .catch(() => {
        if (active) setInvite(null);
      });
    return () => {
      active = false;
    };
  }, [session, joinCode]);

  async function join() {
    setJoining(true);
    setProblem(null);
    try {
      await joinHouse(joinCode);
      await refresh();
      router.replace('/today');
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : String(reason));
      setJoining(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.page}>
        {!session ? (
          <SignInPanel returnTo={`/join/${joinCode}`} />
        ) : invite === undefined ? (
          <ActivityIndicator color={colors.foreground} accessibilityLabel="Looking up the house" />
        ) : (
          <View style={styles.stack}>
            <Wordmark size={32} />
            {!invite ? (
              <>
                <Heading level={2}>{JOIN_COPY.badLink}</Heading>
                <Body muted>{JOIN_COPY.badLinkBody}</Body>
                {!house ? <Button href="/welcome" variant="outline" label={JOIN_COPY.back} /> : null}
              </>
            ) : house?.id === invite.id ? (
              <>
                <Heading level={2}>{JOIN_COPY.alreadyIn(invite.name)}</Heading>
                <Button href="/today" label={JOIN_COPY.goToJohns} />
              </>
            ) : house ? (
              <>
                <Heading level={2}>{JOIN_COPY.otherHouse}</Heading>
                <Body muted>{JOIN_COPY.otherHouseBody}</Body>
                <Button href="/today" variant="outline" label={JOIN_COPY.yourHouse} />
              </>
            ) : (
              <>
                <View>
                  <Eyebrow>{JOIN_COPY.invited}</Eyebrow>
                  <Heading style={styles.name}>{invite.name}</Heading>
                  <Body muted style={styles.size}>
                    {JOIN_COPY.livesHere(invite.members)}
                  </Body>
                </View>
                {problem ? <Alert message={problem} /> : null}
                <Button
                  label={joining ? JOIN_COPY.joining : JOIN_COPY.join(invite.name)}
                  onPress={() => void join()}
                  disabled={joining}
                  testID="join-house"
                />
              </>
            )}
          </View>
        )}
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
  stack: { gap: SPACE.xl },
  name: { marginTop: SPACE.xs },
  size: { marginTop: SPACE.sm },
});
