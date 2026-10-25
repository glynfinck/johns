import { formatBalance, MAKEUP_LABEL, TABLE_COPY, type BalanceRow, type TableRow } from '@app/core';
import { FlameIcon, RepeatIcon, ShieldIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { TextLink } from '@/components/text-link';
import { Body, Eyebrow } from '@/components/text';
import { FONT, RADIUS, SPACE, useTheme } from '@/theme';

/** Who's who on the Table: everyone's name, and which of them is you. */
export interface People {
  me: string;
  nameOf: (userId: string) => string;
}

/**
 * The Table as bars, as on the web. The leader's bar is full width and
 * everyone else is drawn to the same scale, so the gap between two people is
 * the real gap; the last, behind the rest, is in hazard.
 */
export function Standings({ rows, people, dense = false }: { rows: TableRow[]; people: People; dense?: boolean }) {
  const { colors } = useTheme();
  const top = Math.max(1, ...rows.map((r) => r.points));
  const lastRank = rows.length > 1 ? Math.max(...rows.map((r) => r.rank)) : 0;
  return (
    <View style={[styles.rows, { gap: dense ? SPACE.sm : SPACE.md }]}>
      {rows.map((r) => {
        const mine = r.userId === people.me;
        const bottom = rows.length > 1 && r.rank === lastRank && r.points < top;
        return (
          <View key={r.userId} style={styles.standing} testID="standing">
            <Text style={[styles.rank, { color: colors.mutedForeground }]}>{r.rank}</Text>
            <Avatar name={people.nameOf(r.userId)} me={mine} size={28} />
            <View style={styles.grow}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }, mine && styles.strong]}>
                  {mine ? 'You' : people.nameOf(r.userId)}
                </Text>
                {!dense ? <Text style={[styles.small, { color: colors.mutedForeground }]}>{TABLE_COPY.record(r)}</Text> : null}
              </View>
              <View style={[styles.track, { backgroundColor: colors.secondary }]}>
                <View
                  style={[
                    styles.fill,
                    { width: `${(r.points / top) * 100}%`, backgroundColor: bottom ? colors.hazard : colors.hivis },
                  ]}
                />
              </View>
            </View>
            <Text style={[styles.points, { color: colors.foreground }]}>{r.points}</Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Everyone against their share, as bars either side of zero: behind in
 * hazard to the left, ahead in green to the right, drawn to one scale.
 */
export function FairShares({ balances, people, awayMakeup }: { balances: BalanceRow[]; people: People; awayMakeup: number }) {
  const { colors } = useTheme();
  const widest = Math.max(1, ...balances.map((b) => Math.abs(b.balance)));
  return (
    <View style={styles.rows}>
      {balances.map((b) => {
        const mine = b.userId === people.me;
        const width = `${(Math.abs(b.balance) / widest) * 50}%` as const;
        const ink = b.balance <= -0.5 ? colors.hazard : b.balance >= 0.5 ? colors.good : colors.foreground;
        return (
          <View key={b.userId} style={styles.share} testID="fair-share">
            <View style={styles.shareName}>
              <Avatar name={people.nameOf(b.userId)} me={mine} size={24} />
              <Text numberOfLines={1} style={[styles.name, styles.strong, { color: colors.foreground }]}>
                {mine ? 'You' : people.nameOf(b.userId)}
              </Text>
            </View>
            <View aria-hidden style={[styles.track, styles.grow, { backgroundColor: colors.secondary }]}>
              <View style={[styles.zero, { backgroundColor: colors.mutedForeground }]} />
              <View
                style={[
                  styles.fill,
                  styles.from,
                  b.balance < 0 ? { right: '50%', width, backgroundColor: colors.hazard } : { left: '50%', width, backgroundColor: colors.good },
                ]}
              />
            </View>
            <Text style={[styles.balance, { color: ink }]}>{formatBalance(b.balance)}</Text>
          </View>
        );
      })}
      <Body muted style={styles.small}>
        {`${TABLE_COPY.sharesKey} `}
        <Text style={[styles.strong, { color: colors.foreground }]}>{(MAKEUP_LABEL[awayMakeup] ?? '').toLowerCase()}</Text>.
      </Body>
    </View>
  );
}

/** Everyone's streak and tokens, longest streak first, and how the perks work. */
export function Streaks({
  members,
  people,
}: {
  members: { userId: string; name: string; streak: number; immunityTokens: number; swapTokens: number }[];
  people: People;
}) {
  const { colors } = useTheme();
  const byStreak = [...members].sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name));
  return (
    <View style={styles.rows}>
      <View style={styles.perkGrid}>
        {byStreak.map((m) => (
          <View key={m.userId} style={[styles.perkCard, { borderColor: colors.border }]} testID="streak">
            <Avatar name={m.name} me={m.userId === people.me} />
            <View style={styles.grow}>
              <Text numberOfLines={1} style={[styles.name, styles.strong, { color: colors.foreground }]}>
                {m.userId === people.me ? 'You' : m.name}
              </Text>
              <View style={styles.perks}>
                <View style={styles.perk}>
                  <FlameIcon size={14} color={colors.mutedForeground} aria-hidden />
                  <Text style={[styles.small, { color: colors.mutedForeground }]}>{TABLE_COPY.weeks(m.streak)}</Text>
                </View>
                {m.immunityTokens > 0 ? (
                  <View style={styles.perk}>
                    <ShieldIcon size={14} color={colors.mutedForeground} aria-hidden />
                    <Text style={[styles.small, { color: colors.mutedForeground }]}>{m.immunityTokens}</Text>
                  </View>
                ) : null}
                {m.swapTokens > 0 ? (
                  <View style={styles.perk}>
                    <RepeatIcon size={14} color={colors.mutedForeground} aria-hidden />
                    <Text style={[styles.small, { color: colors.mutedForeground }]}>{TABLE_COPY.swap}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.rules}>
        {TABLE_COPY.rules.map((rule) => (
          <View key={rule.term} style={styles.rule}>
            <Text style={[styles.name, styles.strong, { color: colors.foreground }]}>{rule.term}</Text>
            <Body muted style={styles.ruleBody}>
              {rule.body}
            </Body>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The week's Table in a card, beside Today and the board, with the way to the full one. */
export function TableBeside({ rows, people }: { rows: TableRow[]; people: People }) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <Eyebrow>{TABLE_COPY.beside}</Eyebrow>
        <TextLink href="/table" label={TABLE_COPY.full} style={styles.link} />
      </View>
      <Standings rows={rows} people={people} dense />
    </Card>
  );
}

/** Where you stand against your share lately, as on the web's Today. */
export function ShareCard({ balance }: { balance: BalanceRow }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.card}>
      <View style={styles.cardTop} testID="my-share">
        <Eyebrow>{TABLE_COPY.yourShare}</Eyebrow>
        <TextLink href="/table" label={TABLE_COPY.everyones} style={styles.link} />
      </View>
      <Text style={[styles.big, { color: colors.foreground }]}>{formatBalance(balance.balance)}</Text>
      <Body muted style={styles.ruleBody}>
        {TABLE_COPY.shareLine(balance.balance, balance.weeksToEven)}
      </Body>
    </Card>
  );
}

const styles = StyleSheet.create({
  rows: { gap: SPACE.md },
  standing: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  rank: { width: 18, fontFamily: FONT.extrabold, fontSize: 12 },
  grow: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: SPACE.sm },
  name: { flexShrink: 1, fontFamily: FONT.semibold, fontSize: 14 },
  strong: { fontFamily: FONT.extrabold },
  small: { fontFamily: FONT.regular, fontSize: 12 },
  track: { height: 8, marginTop: SPACE.xs, borderRadius: 2, overflow: 'hidden', position: 'relative' },
  fill: { height: '100%', borderRadius: 2 },
  from: { position: 'absolute', top: 0, bottom: 0 },
  zero: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, opacity: 0.4 },
  points: { width: 40, textAlign: 'right', fontFamily: FONT.black, fontSize: 16 },
  share: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  shareName: { width: 128, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  balance: { width: 56, textAlign: 'right', fontFamily: FONT.black, fontSize: 14 },
  perkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md },
  perkCard: {
    flexGrow: 1,
    flexBasis: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    borderWidth: 1,
    borderRadius: RADIUS,
    padding: SPACE.md,
  },
  perks: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md, marginTop: 2 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  rules: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.lg },
  rule: { flexGrow: 1, flexBasis: 220, gap: 2 },
  ruleBody: { fontSize: 14, lineHeight: 20 },
  card: { gap: SPACE.md },
  cardTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACE.md },
  link: { fontFamily: FONT.bold, fontSize: 12 },
  big: { fontFamily: FONT.black, fontSize: 30 },
});
