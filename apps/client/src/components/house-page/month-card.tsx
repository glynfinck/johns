import { HISTORY_COPY, HOUSE_PAGE_COPY, monthCard, settleRows, type SettleRow } from '@app/core';
import type { UseQueryResult } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { CheckIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react-native';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { confirmPayment, type StakeRead } from '@/api/stake';
import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card, CardRows } from '@/components/card';
import { Reading, ReadFailed } from '@/components/read-state';
import { Row } from '@/components/row';
import { Lead, Meta, SectionLabel } from '@/components/text';
import { useToastIfAny } from '@/components/toast';
import type { HouseView } from '@/hooks/use-house';
import { useMove } from '@/hooks/use-move';
import { useUndoOffer } from '@/hooks/use-undo-offer';
import { SPACE, useTheme } from '@/theme';

/** Where "Open Splitwise" goes: its web app, which hands over to the Splitwise app where it's installed. */
const SPLITWISE_URL = 'https://secure.splitwise.com/';

/**
 * House's one card: your month so far as the Lead (the figure green only
 * when you're up), what you've forfeited and when it's shared out; then
 * each settle-up between you and a housemate, what's owed to you with its
 * "Mark received" (the first one the page's amber button); then the way to
 * Stake history. A house that settles up in Splitwise gets each amount to
 * copy across and "Added to Splitwise" in place of "Mark received", with
 * Open Splitwise under them.
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
        settleIn: view.snapshot.house.settleIn,
      })
    : [];
  const toSplitwise = rows.some((row) => row.splitwise);

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
        {toSplitwise ? (
          <View style={styles.action}>
            <Button
              variant="outline"
              icon={ExternalLinkIcon}
              iconAfter
              label={HOUSE_PAGE_COPY.openSplitwise}
              onPress={() => void Linking.openURL(SPLITWISE_URL)}
              testID="open-splitwise"
            />
          </View>
        ) : null}
        <Row title={HOUSE_PAGE_COPY.history} href="/house/stake" chevron testID="to-stake" />
      </CardRows>
    </Card>
  );
}

/**
 * One settle-up, from your side: the row, and for what's owed to you the
 * button that says it arrived, or in a Splitwise house its description
 * and amount to copy, then the button that says it's been added there.
 */
function SettleUp({ houseId, row }: { houseId: string; row: SettleRow }) {
  const move = useMove(houseId);
  const offer = useUndoOffer(houseId);
  const toasts = useToastIfAny();
  const splitwise = row.splitwise;
  return (
    <View testID="transfer">
      {/* The months it's from are in the title: two lines, so it isn't cut off. */}
      <Row leading={<Avatar name={row.name} userId={row.userId} />} title={row.title} titleLines={2} meta={row.meta} />
      {splitwise ? (
        <View style={styles.copy} testID="splitwise-line">
          <Meta style={styles.description}>{splitwise.description}</Meta>
          <Button
            variant="outline"
            icon={CopyIcon}
            label={splitwise.copy}
            spoken={splitwise.spoken}
            onPress={() =>
              void Clipboard.setStringAsync(splitwise.amount).then(() => toasts?.show(HOUSE_PAGE_COPY.copied(splitwise.amount)))
            }
            testID="copy-amount"
          />
        </View>
      ) : null}
      {row.action ? (
        <View style={styles.action}>
          <Button
            variant={row.primary ? 'primary' : 'outline'}
            icon={CheckIcon}
            label={move.pending ? HOUSE_PAGE_COPY.marking : row.action}
            spoken={move.pending ? undefined : (row.spoken ?? undefined)}
            disabled={move.pending}
            onPress={() =>
              void move
                .run(() =>
                  splitwise ? confirmPayment(houseId, row.userId, row.amount, 'splitwise') : confirmPayment(houseId, row.userId, row.amount),
                )
                .then((done) => {
                  if (done) offer(splitwise ? HISTORY_COPY.inSplitwise : HISTORY_COPY.paid, 'payment', row.userId);
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
  copy: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.xs },
  description: { flex: 1 },
  problem: { marginBottom: SPACE.lg },
});
