import { DEAL_COPY, NOT_DEALT_COPY } from '@app/core';
import { HouseIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DealButton } from '@/components/house/deal-button';
import { Body, Heading } from '@/components/text';
import { SPACE, useTheme } from '@/theme';

/**
 * Before there's anything to do this week, as on the web. An admin gets the
 * first steps, the way to House (where the John list and the join link
 * are), and the deal itself.
 */
export function NotDealt({
  houseId,
  notStarted,
  isAdmin,
  adminName,
}: {
  houseId: string;
  notStarted: boolean;
  isAdmin: boolean;
  adminName: string;
}) {
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
          <Body muted>{DEAL_COPY.fromHouse}</Body>
          <View style={styles.actions}>
            <DealButton houseId={houseId} started={false} />
            <View>
              <Button variant="outline" icon={HouseIcon} label={DEAL_COPY.openHouse} href="/house" />
            </View>
          </View>
        </>
      ) : (
        <Body muted>{NOT_DEALT_COPY.waitingFor(adminName)}</Body>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: SPACE.sm, marginTop: SPACE.sm },
  stripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 6 },
});
