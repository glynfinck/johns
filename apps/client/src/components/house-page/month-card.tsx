import { HISTORY_COPY, HOUSE_PAGE_COPY, monthCard, settleRows, type SettleRow } from '@app/core';
import type { UseQueryResult } from '@tanstack/react-query';
import { CheckIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { confirmPayment, type StakeRead } from '@/api/stake';
import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card, CardRows } from '@/components/card';
import { Reading, ReadFailed } from '@/components/read-state';
import { Row } from '@/components/row';
import { Lead, Meta, SectionLabel } from '@/components/text';
import type { HouseView } from '@/hooks/use-house';
import { useMove } from '@/hooks/use-move';
import { useUndoOffer } from '@/hooks/use-undo-offer';
import { SPACE, useTheme } from '@/theme';

/**
 * House's one card: your month so far as the Lead (the figure green only
 * when you're up), what you've forfeited and when it's shared out; then
 * each settle-up between you and a housemate, what's owed to you with its
 * "Mark received" (the first one the page's amber button); then the way to
 * Stake history.
 */
export function MonthCard({ houseId, userId, view, stake }: { houseId: string; userId: string; view: HouseView; stake: UseQueryResult<StakeRead> }) {
  const { colors } = useTheme();
  const { rules, members } = view.snapshot;
  const data = stake.data;
  const card = data ? monthCard(data, userId, rules.currency) : null;
  const rows = data
    ? settleRows({
        transfers: data.transfers,
        me: userId,
        members,
        currency: rules.currency,
        ledger: data.ledger,
        closedMonths: data.closedMonths,
      })
    : [];

  return (
    <Card testID="month-card" style={styles.card}>
      {card ? (
        <>
          <SectionLabel>{card.label}</SectionLabel>
          <Lead style={styles.lead} testID="month-lead">
            {card.lead}
            {card.figure ? (
              <>
                {' '}
                <Text style={card.good ? { color: colors.good } : undefined}>{card.figure}</Text>
              </>
            ) : null}
          </Lead>
          <Meta numberOfLines={1}>{card.meta}</Meta>
        </>
      ) : stake.isError ? (
        <ReadFailed message={HOUSE_PAGE_COPY.stakeUnreadable} onRetry={() => void stake.refetch()} />
      ) : (
        <Reading label={HOUSE_PAGE_COPY.readingStake} />
      )}
      <CardRows>
        {rows.map((row) => (
          <SettleUp key={row.key} houseId={houseId} row={row} />
        ))}
        <Row title={HOUSE_PAGE_COPY.history} href="/house/stake" chevron testID="to-stake" />
      </CardRows>
    </Card>
  );
}

/** One settle-up, from your side: the row, and for what's owed to you the button that says it arrived. */
function SettleUp({ houseId, row }: { houseId: string; row: SettleRow }) {
  const move = useMove(houseId);
  const offer = useUndoOffer(houseId);
  return (
    <View testID="transfer">
      {/* The months it's from are in the title: two lines, so it isn't cut off. */}
      <Row leading={<Avatar name={row.name} />} title={row.title} titleLines={2} meta={row.meta} />
      {row.action ? (
        <View style={styles.action}>
          <Button
            variant={row.primary ? 'primary' : 'outline'}
            icon={CheckIcon}
            label={move.pending ? HOUSE_PAGE_COPY.marking : row.action}
            spoken={move.pending ? undefined : (row.spoken ?? undefined)}
            disabled={move.pending}
            onPress={() =>
              void move.run(() => confirmPayment(houseId, row.userId, row.amount)).then((done) => {
                if (done) offer(HISTORY_COPY.paid, 'payment', row.userId);
              })
            }
          />
        </View>
      ) : null}
      {move.problem ? (
        <View style={styles.problem}>
          <Alert message={move.problem} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The last row (Stake history) brings its own room underneath.
  card: { paddingBottom: SPACE.sm },
  lead: { marginTop: SPACE.sm, marginBottom: SPACE.xs },
  action: { marginTop: SPACE.xs, marginBottom: SPACE.lg },
  problem: { marginBottom: SPACE.lg },
});
