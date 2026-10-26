import { FOCUS_SHELL_COPY, formatMoney, monthLabel, PAGE_TITLE, SECTION_LABEL, STAKE_COPY } from '@app/core';
import { StyleSheet, View } from 'react-native';

import { Alert } from '@/components/alert';
import { Card } from '@/components/card';
import { PageTitle } from '@/components/page-title';
import { Reading } from '@/components/read-state';
import { Screen } from '@/components/screen';
import { Ledger, MonthSoFar, SettleUp, type Payers } from '@/components/stake-parts';
import { Body, Eyebrow } from '@/components/text';
import { TitleBar } from '@/components/title-bar';
import { useHouse } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { usePull } from '@/hooks/use-refresh';
import { useStake } from '@/hooks/use-stake';
import { SPACE } from '@/theme';

/**
 * The Stake: this month so far, settling up, and the ledger, pushed from
 * House. For now the old Stake's content; the House track turns it into
 * Stake history.
 */
export default function StakeScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <StakeFor houseId={house!.id} userId={session!.user.id} />;
}

function StakeFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { query, view } = useHouse(houseId, userId);
  const stake = useStake(houseId, query.data);
  const { refreshing, pull } = usePull(houseId, () => Promise.all([query.refetch(), stake.refetch()]));

  const members = view?.snapshot.members ?? [];
  const realName = (id: string) => members.find((m) => m.userId === id)?.name ?? FOCUS_SHELL_COPY.formerHousemate;
  const people: Payers = { me: userId, realName, nameOf: (id) => (id === userId ? 'You' : realName(id)) };
  const rules = view?.snapshot.rules;

  return (
    <Screen
      bar={<TitleBar title={STAKE_COPY.title} back="/house" backLabel={SECTION_LABEL.house} />}
      refreshing={refreshing}
      onRefresh={pull}
      testID="stake-screen"
    >
      <PageTitle page={PAGE_TITLE.stake} />
      <View style={styles.stack}>
        <Eyebrow>{rules ? STAKE_COPY.eyebrow(formatMoney(rules.stakeMinor, rules.currency)) : ''}</Eyebrow>

        {query.isError || stake.isError ? <Alert message="Couldn't read the Stake. Check the connection." /> : null}

        {!view || !rules || !stake.data ? (
          <Reading label="Reading the Stake" />
        ) : (
          <>
            <Card style={styles.card}>
              <Eyebrow>{STAKE_COPY.soFar(monthLabel(stake.data.month))}</Eyebrow>
              <Body muted style={styles.body}>
                {STAKE_COPY.soFarBody(formatMoney(rules.lateForfeitMinor, rules.currency), formatMoney(rules.missedForfeitMinor, rules.currency))}
              </Body>
              <MonthSoFar stake={stake.data} people={people} currency={rules.currency} />
            </Card>
            <Card style={styles.card}>
              <Eyebrow>{STAKE_COPY.settleUp}</Eyebrow>
              <Body muted style={styles.body}>
                {STAKE_COPY.settleBody}
              </Body>
              <SettleUp houseId={houseId} transfers={stake.data.transfers} people={people} currency={rules.currency} />
            </Card>
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
  card: { gap: SPACE.md },
  body: { fontSize: 14, lineHeight: 20 },
});
