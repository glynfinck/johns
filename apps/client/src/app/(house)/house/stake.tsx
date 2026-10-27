import { formatMoney, HOUSE_PAGE_COPY, SECTION_LABEL, STAKE_HISTORY_COPY, stakeHistory } from '@app/core';
import { CoinsIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { StakeHistory } from '@/components/house-page/stake-history';
import { PageTitle } from '@/components/page-title';
import { Reading, ReadFailed } from '@/components/read-state';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { TitleBar } from '@/components/title-bar';
import { useHouse } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { usePull } from '@/hooks/use-refresh';
import { useStake } from '@/hooks/use-stake';
import { INSET } from '@/theme';

/**
 * Stake history, pushed from House's month card: the ledger by month, every
 * forfeit naming its John, payments and shares in words, yours or the whole
 * house's. The month so far and settling up live on House.
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
  const [whole, setWhole] = useState(false);

  const rules = view?.snapshot.rules;
  const months =
    view && rules && stake.data
      ? stakeHistory({
          ledger: stake.data.ledger,
          me: userId,
          whole,
          members: view.snapshot.members,
          currency: rules.currency,
          zone: rules.timezone,
        })
      : null;
  const empty = months?.length === 0;
  const nothingAtAll = stake.data?.ledger.length === 0;

  return (
    <Screen
      bar={
        <TitleBar
          title={STAKE_HISTORY_COPY.title}
          sub={rules ? STAKE_HISTORY_COPY.sub(formatMoney(rules.stakeMinor, rules.currency)) : undefined}
          back="/house"
          backLabel={SECTION_LABEL.house}
        />
      }
      refreshing={refreshing}
      onRefresh={pull}
      testID="stake-screen"
    >
      <PageTitle page={STAKE_HISTORY_COPY.title} />
      {!months ? (
        query.isError || stake.isError ? (
          <ReadFailed
            message={query.isError ? undefined : HOUSE_PAGE_COPY.stakeUnreadable}
            onRetry={() => void Promise.all([query.refetch(), stake.refetch()])}
          />
        ) : (
          <Reading label={HOUSE_PAGE_COPY.readingStake} />
        )
      ) : nothingAtAll ? (
        <EmptyState icon={CoinsIcon} title={STAKE_HISTORY_COPY.empty} body={STAKE_HISTORY_COPY.emptyBody} />
      ) : (
        <>
          <View style={styles.switch}>
            <Segmented
              options={[
                { value: 'mine', label: STAKE_HISTORY_COPY.mine },
                { value: 'whole', label: STAKE_HISTORY_COPY.whole },
              ]}
              value={whole ? 'whole' : 'mine'}
              onChange={(value) => setWhole(value === 'whole')}
              label={STAKE_HISTORY_COPY.show}
              testID="stake-span"
            />
          </View>
          {empty ? (
            <EmptyState icon={CoinsIcon} title={STAKE_HISTORY_COPY.empty} body={STAKE_HISTORY_COPY.emptyMine} />
          ) : (
            <StakeHistory months={months} />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // On the leading edge, where the sections' labels start.
  switch: { paddingHorizontal: INSET },
});
