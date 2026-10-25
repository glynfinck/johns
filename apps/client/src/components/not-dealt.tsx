import { NOT_DEALT_COPY } from '@app/core';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Body, Heading } from '@/components/text';
import { SITE_URL } from '@/links';
import { SPACE, useTheme } from '@/theme';

/**
 * Before there's anything to do this week, as on the web. Setting the house
 * up and handing out the week arrive in the app with House (Phase 11 of
 * docs/specs/native-migration.md); until then an admin does both on the web.
 */
export function NotDealt({ notStarted, isAdmin, adminName }: { notStarted: boolean; isAdmin: boolean; adminName: string }) {
  const { colors } = useTheme();
  if (!notStarted) {
    return (
      <Card style={styles.card}>
        <Heading level={3}>{NOT_DEALT_COPY.nothingThisWeek}</Heading>
        <Body muted>{NOT_DEALT_COPY.nothingThisWeekBody}</Body>
      </Card>
    );
  }
  return (
    <Card style={styles.card}>
      <View aria-hidden style={[styles.stripe, { backgroundColor: colors.hivis }]} />
      <Heading level={3}>{NOT_DEALT_COPY.notYet}</Heading>
      {isAdmin ? (
        <>
          {NOT_DEALT_COPY.adminSteps.map((step, i) => (
            <Body key={step}>{`${i + 1}. ${step}`}</Body>
          ))}
          <Body muted>{`For now, do these on the web at ${SITE_URL.replace('https://', '')}.`}</Body>
        </>
      ) : (
        <Body muted>{NOT_DEALT_COPY.waitingFor(adminName)}</Body>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.sm },
  stripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 6 },
});
