import { formatMoney, formatSigned, STAKE_COPY, type Currency, type StakeView, type Transfer } from '@app/core';
import { ArrowRightIcon, BanknoteIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { confirmPayment } from '@/api/stake';
import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Body, Eyebrow } from '@/components/text';
import { TextLink } from '@/components/text-link';
import { useMove } from '@/hooks/use-move';
import { FONT, RADIUS, SPACE, useTheme } from '@/theme';

/** Who's who on the Stake: everyone's name ("You" for you) and their real one, for the plates. */
export interface Payers {
  me: string;
  nameOf: (userId: string) => string;
  realName: (userId: string) => string;
}

/** This month so far, as if it ended now: forfeits (capped at the stake), shares, and where each would stand. */
export function MonthSoFar({ stake, people, currency }: { stake: StakeView; people: Payers; currency: Currency }) {
  const { colors } = useTheme();
  const money = (n: number) => formatMoney(n, currency);
  const head = [styles.th, { color: colors.mutedForeground }];
  return (
    <View testID="month-so-far">
      <View style={[styles.tr, styles.thead, { borderBottomColor: colors.foreground }]}>
        <Text style={[head, styles.who]}>{STAKE_COPY.columns.who}</Text>
        <Text style={[head, styles.num]}>{STAKE_COPY.columns.forfeited}</Text>
        <Text style={[head, styles.num]}>{STAKE_COPY.columns.share}</Text>
        <Text style={[head, styles.num]}>{STAKE_COPY.columns.ifNow}</Text>
      </View>
      {stake.projection.map((p, i) => (
        <View
          key={p.userId}
          testID="projection"
          style={[styles.tr, i < stake.projection.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
        >
          <View style={[styles.who, styles.person]}>
            <Avatar name={people.realName(p.userId)} me={p.userId === people.me} size={24} />
            <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>
              {people.nameOf(p.userId)}
            </Text>
          </View>
          <View style={styles.num}>
            <Text style={[styles.cell, { color: colors.foreground }]}>{p.forfeited ? money(p.forfeited) : '–'}</Text>
            {p.forfeitedRaw > p.forfeited ? (
              <Text style={[styles.small, { color: colors.mutedForeground }]}>{STAKE_COPY.capped}</Text>
            ) : null}
          </View>
          <Text style={[styles.cell, styles.num, { color: colors.foreground }]}>{p.received ? money(p.received) : '–'}</Text>
          <Text
            style={[
              styles.cell,
              styles.num,
              styles.strong,
              { color: p.net < 0 ? colors.hazard : p.net > 0 ? colors.good : colors.foreground },
            ]}
          >
            {formatSigned(p.net, currency)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Who pays whom to settle the closed months; the person paid marks it received. */
export function SettleUp({
  houseId,
  transfers,
  people,
  currency,
}: {
  houseId: string;
  transfers: Transfer[];
  people: Payers;
  currency: Currency;
}) {
  const { colors } = useTheme();
  if (transfers.length === 0) {
    return (
      <View style={[styles.square, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.name, { color: colors.foreground }]}>{STAKE_COPY.square}</Text>
      </View>
    );
  }
  return (
    <View style={styles.list}>
      {transfers.map((t) => (
        <TransferRow key={`${t.from}-${t.to}`} houseId={houseId} transfer={t} people={people} currency={currency} />
      ))}
    </View>
  );
}

function TransferRow({
  houseId,
  transfer,
  people,
  currency,
}: {
  houseId: string;
  transfer: Transfer;
  people: Payers;
  currency: Currency;
}) {
  const { colors } = useTheme();
  const move = useMove(houseId);
  return (
    <View testID="transfer" style={[styles.transfer, { borderColor: colors.border }]}>
      <View style={styles.transferRow}>
        <Text style={[styles.name, { color: colors.foreground }]}>{people.nameOf(transfer.from)}</Text>
        <ArrowRightIcon size={16} color={colors.mutedForeground} accessibilityLabel={STAKE_COPY.pays} />
        <Text style={[styles.name, { color: colors.foreground }]}>{people.nameOf(transfer.to)}</Text>
        <Text style={[styles.amount, { color: colors.foreground }]}>{formatMoney(transfer.amount, currency)}</Text>
      </View>
      {transfer.to === people.me ? (
        <View style={styles.start}>
          <Button
            variant="outline"
            icon={BanknoteIcon}
            label={move.pending ? STAKE_COPY.saving : STAKE_COPY.markReceived}
            disabled={move.pending}
            onPress={() => void move.run(() => confirmPayment(houseId, transfer.from, transfer.amount))}
          />
        </View>
      ) : null}
      {move.problem ? <Alert message={move.problem} /> : null}
    </View>
  );
}

/** The latest ledger entries: what happened to whose money, and when. */
export function Ledger({ stake, people, currency }: { stake: StakeView; people: Payers; currency: Currency }) {
  const { colors } = useTheme();
  if (stake.history.length === 0) return <Body muted style={styles.body}>{STAKE_COPY.ledgerEmpty}</Body>;
  return (
    <View>
      {stake.history.map((h, i) => (
        <View
          key={h.id}
          testID="ledger-entry"
          style={[styles.entry, i < stake.history.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
        >
          <View style={styles.grow}>
            <Text style={[styles.cell, { color: colors.foreground }]}>
              {STAKE_COPY.kind[h.kind] ?? h.kind}
              {h.kind === 'payment' && h.counterparty ? (
                <Text style={{ color: colors.mutedForeground }}>{` ${STAKE_COPY.counterparty(h.amount, people.nameOf(h.counterparty))}`}</Text>
              ) : null}
            </Text>
            <Text style={[styles.small, { color: colors.mutedForeground }]}>{`${people.nameOf(h.userId)} · ${h.month}`}</Text>
          </View>
          <Text style={[styles.cell, styles.strong, { color: h.amount < 0 ? colors.hazard : colors.good }]}>
            {formatSigned(h.amount, currency)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Your stake this month, on Today, as on the web. */
export function StakeCard({ stake, me, currency }: { stake: StakeView; me: string; currency: Currency }) {
  const { colors } = useTheme();
  const mine = stake.projection.find((p) => p.userId === me);
  if (!mine) return null;
  return (
    <Card style={styles.card}>
      <View style={styles.cardTop} testID="my-stake">
        <Eyebrow>{STAKE_COPY.yours}</Eyebrow>
        <TextLink href="/stake" label={STAKE_COPY.title} style={styles.link} />
      </View>
      <Text style={[styles.big, { color: colors.foreground }]}>{formatMoney(stake.stakeMinor, currency)}</Text>
      <Body muted style={styles.body}>
        {`${STAKE_COPY.forfeitedSoFar(mine.forfeited > 0 ? formatMoney(mine.forfeited, currency) : null)} ${STAKE_COPY.ifNow} ${formatSigned(mine.net, currency)}.`}
      </Body>
    </Card>
  );
}

const styles = StyleSheet.create({
  tr: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: SPACE.sm },
  thead: { borderBottomWidth: 2, minHeight: 32 },
  th: { fontFamily: FONT.bold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  who: { flex: 2, minWidth: 0 },
  person: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  num: { flex: 1, textAlign: 'right', alignItems: 'flex-end' },
  name: { flexShrink: 1, fontFamily: FONT.bold, fontSize: 14 },
  cell: { fontFamily: FONT.regular, fontSize: 14 },
  strong: { fontFamily: FONT.black },
  small: { fontFamily: FONT.regular, fontSize: 12 },
  square: { borderRadius: RADIUS, padding: SPACE.lg },
  list: { gap: SPACE.sm },
  transfer: { borderWidth: 1, borderRadius: RADIUS, padding: SPACE.md, gap: SPACE.sm },
  transferRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.sm },
  amount: { marginLeft: 'auto', fontFamily: FONT.black, fontSize: 18 },
  start: { alignItems: 'flex-start' },
  entry: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm },
  grow: { flex: 1, minWidth: 0 },
  body: { fontSize: 14, lineHeight: 20 },
  card: { gap: SPACE.sm },
  cardTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACE.md },
  link: { fontFamily: FONT.bold, fontSize: 12 },
  big: { fontFamily: FONT.black, fontSize: 30 },
});
