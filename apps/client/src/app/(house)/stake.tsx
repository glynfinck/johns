import { formatMoney, monthLabel, STAKE_COPY } from '@app/core';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Alert } from '@/components/alert';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { Ledger, MonthSoFar, SettleUp, type Payers } from '@/components/stake-parts';
import { Body, Eyebrow, Heading } from '@/components/text';
import { useCatchUp, useHouse } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { useStake } from '@/hooks/use-stake';
import { SPACE, useTheme, WIDE } from '@/theme';

/** The Stake: this month so far, settling up, and the ledger, as the web's /stake. */
export default function StakeScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <StakeFor houseId={house!.id} userId={session!.user.id} />;
}

function StakeFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { colors } = useTheme();
  const wide = useWindowDimensions().width >= WIDE;
  const { query, view } = useHouse(houseId, userId);
  const stake = useStake(houseId, query.data);
  const [refreshing, setRefreshing] = useState(false);
  const freshen = useCatchUp(houseId);

  async function pull() {
    setRefreshing(true);
    if (!(await freshen())) await Promise.all([query.refetch(), stake.refetch()]);
    setRefreshing(false);
  }

  const members = view?.snapshot.members ?? [];
  const realName = (id: string) => members.find((m) => m.userId === id)?.name ?? 'A former housemate';
  const people: Payers = { me: userId, realName, nameOf: (id) => (id === userId ? 'You' : realName(id)) };
  const rules = view?.snapshot.rules;

  return (
    <Screen maxWidth={wide ? 1152 : 720} refreshing={refreshing} onRefresh={() => void pull()} testID="stake-screen">
      <View style={styles.stack}>
        <View>
          <Eyebrow>{rules ? STAKE_COPY.eyebrow(formatMoney(rules.stakeMinor, rules.currency)) : ''}</Eyebrow>
          <Heading style={styles.title}>{STAKE_COPY.title}</Heading>
        </View>

        {query.isError || stake.isError ? <Alert message="Couldn't read the Stake. Check the connection." /> : null}

        {!view || !rules || !stake.data ? (
          <ActivityIndicator color={colors.foreground} accessibilityLabel="Reading the Stake" style={styles.loading} />
        ) : (
          <>
            <View style={[styles.pair, wide && styles.pairWide]}>
              <Card style={[styles.card, wide && styles.half]}>
                <Eyebrow>{STAKE_COPY.soFar(monthLabel(stake.data.month))}</Eyebrow>
                <Body muted style={styles.body}>
                  {STAKE_COPY.soFarBody(formatMoney(rules.lateForfeitMinor, rules.currency), formatMoney(rules.missedForfeitMinor, rules.currency))}
                </Body>
                <MonthSoFar stake={stake.data} people={people} currency={rules.currency} />
              </Card>
              <Card style={[styles.card, wide && styles.half]}>
                <Eyebrow>{STAKE_COPY.settleUp}</Eyebrow>
                <Body muted style={styles.body}>
                  {STAKE_COPY.settleBody}
                </Body>
                <SettleUp houseId={houseId} transfers={stake.data.transfers} people={people} currency={rules.currency} />
              </Card>
            </View>
            <Card style={styles.card}>
              <Eyebrow>{STAKE_COPY.ledger}</Eyebrow>
              <Ledger stake={stake.data} people={people} currency={rules.currency} />
            </Card>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  title: { marginTop: SPACE.xs },
  loading: { marginTop: SPACE.xxl },
  pair: { gap: SPACE.lg },
  pairWide: { flexDirection: 'row', alignItems: 'flex-start' },
  half: { flex: 1 },
  card: { gap: SPACE.md },
  body: { fontSize: 14, lineHeight: 20 },
});
