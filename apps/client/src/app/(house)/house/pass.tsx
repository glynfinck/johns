import { PAGE_TITLE, PASS_COPY, PASS_FREE_HISTORY_WEEKS, passLine, passOffers } from '@app/core';
import { CameraIcon, CoinsIcon, HistoryIcon, TrophyIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { HousePage } from '@/components/house/house-page';
import { Row, RowIcon } from '@/components/row';
import { Section } from '@/components/section';
import { Body, Meta } from '@/components/text';
import { useHouse } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { usePull, useReadOnFocus } from '@/hooks/use-refresh';
import { INSET, SPACE } from '@/theme';

/**
 * The House Pass, pushed from House: where the house stands, what the Pass
 * gives everyone in it, and the plans. A Founding house sees its thanks in
 * place of the plans. Buying waits for the store release, so the plans are
 * shown, not sold, and the page says so.
 */
export default function PassScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <PassFor houseId={house!.id} userId={session!.user.id} />;
}

function PassFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { query, view } = useHouse(houseId, userId);
  // A purchase lands from the store's webhook, not over Realtime.
  useReadOnFocus(query.refetch);
  const { refreshing, pull } = usePull(houseId, query.refetch);

  return (
    <HousePage
      title={PAGE_TITLE.pass}
      testID="pass-screen"
      ready={view !== null}
      failed={query.isError}
      onRetry={() => void query.refetch()}
      refreshing={refreshing}
      onRefresh={pull}
    >
      {() => {
        const { house, rules, members } = view!.snapshot;
        const { pass } = house;
        const founding = pass.plan === 'founding';
        const buyer = pass.buyerId ? members.find((m) => m.userId === pass.buyerId)?.name : undefined;
        return (
          <>
            <View style={styles.words}>
              <Body testID="pass-lead">{founding ? PASS_COPY.foundingLead : PASS_COPY.lead}</Body>
              <Meta testID="pass-line">
                {buyer ? `${passLine(pass, view!.now, rules.timezone)} · ${PASS_COPY.boughtBy(buyer)}` : passLine(pass, view!.now, rules.timezone)}
              </Meta>
            </View>

            <Section label={PASS_COPY.includes}>
              <Row leading={<RowIcon icon={CoinsIcon} />} title={PASS_COPY.stake} meta={PASS_COPY.stakeMeta} />
              <Row leading={<RowIcon icon={TrophyIcon} />} title={PASS_COPY.table} meta={PASS_COPY.tableMeta} />
              <Row leading={<RowIcon icon={CameraIcon} />} title={PASS_COPY.photos} meta={PASS_COPY.photosMeta} />
              <Row
                leading={<RowIcon icon={HistoryIcon} />}
                title={PASS_COPY.history}
                meta={PASS_COPY.historyMeta(PASS_FREE_HISTORY_WEEKS)}
              />
            </Section>

            {founding ? null : (
              <Section label={PASS_COPY.plans} testID="pass-plans">
                {passOffers(rules.currency).map((offer) => (
                  <Row
                    key={offer.plan}
                    title={offer.label}
                    meta={offer.meta}
                    trailing={offer.price}
                    disabled
                    testID={`plan-${offer.plan}`}
                  />
                ))}
              </Section>
            )}

            <View style={styles.words}>
              {founding ? null : <Meta testID="pass-soon">{PASS_COPY.buyingSoon}</Meta>}
              <Meta>{PASS_COPY.free}</Meta>
            </View>
          </>
        );
      }}
    </HousePage>
  );
}

const styles = StyleSheet.create({
  // On the leading edge, where the sections' labels start.
  words: { paddingHorizontal: INSET, gap: SPACE.sm },
});
