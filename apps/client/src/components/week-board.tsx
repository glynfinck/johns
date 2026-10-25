import {
  AWAY_COPY,
  dueLabel,
  firstName,
  isOpen,
  lidColour,
  pointsEarned,
  relative,
  WEEK_COPY,
  type BoardItem,
} from '@app/core';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { DisputeButton, VoteButtons } from '@/components/dispute';
import { HazardTape } from '@/components/hazard-tape';
import { CompactTick, JohnCard } from '@/components/john-card';
import { StatusChip } from '@/components/status-chip';
import { Body, Eyebrow } from '@/components/text';
import { FONT, SPACE, useTheme } from '@/theme';

/** Who's looking, and how to name everyone else: what every part of the board needs. */
export interface BoardContext {
  houseId: string;
  userId: string;
  zone: string;
  now: Date;
  nameOf: (userId: string) => string;
}

/** The week in four numbers, as on the web: done, being checked, overdue, disputed. */
export function Stats({ items }: { items: BoardItem[] }) {
  const { colors } = useTheme();
  const twoUp = useWindowDimensions().width < 640;
  const done = items.filter((i) => !isOpen(i.status) && i.status !== 'missed').length;
  const stats = [
    { label: WEEK_COPY.done, value: WEEK_COPY.doneOf(done, items.length), hazard: false },
    { label: WEEK_COPY.checking, value: String(items.filter((i) => i.status === 'checking').length), hazard: false },
    { label: WEEK_COPY.overdue, value: String(items.filter((i) => i.status === 'overdue').length), hazard: true },
    { label: WEEK_COPY.disputed, value: String(items.filter((i) => i.dispute).length), hazard: true },
  ];
  return (
    <View style={styles.stats}>
      {stats.map((s) => (
        <Card key={s.label} style={[styles.stat, { flexBasis: twoUp ? '47%' : '22%' }]}>
          <Eyebrow>{s.label}</Eyebrow>
          <Text
            testID={`stat-${s.label}`}
            style={[styles.statValue, { color: s.hazard && s.value !== '0' ? colors.hazard : colors.foreground }]}
          >
            {s.value}
          </Text>
        </Card>
      ))}
    </View>
  );
}

/** A phone's board: one section per housemate, with cards you can act on. */
export function PersonSection({
  context,
  userId,
  items,
  immunityTokens,
  away = null,
}: {
  context: BoardContext;
  userId: string;
  items: BoardItem[];
  immunityTokens: number;
  /** "Away 21–23 Oct", when they are this week. */
  away?: string | null;
}) {
  const { colors } = useTheme();
  const mine = userId === context.userId;
  const name = context.nameOf(userId);
  return (
    <View style={styles.section} testID={`person-${userId}`}>
      <View style={styles.person}>
        <Avatar name={name} me={mine} />
        <Text style={[styles.personName, { color: colors.foreground }]}>{mine ? WEEK_COPY.you : name}</Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {`${items.filter((i) => !isOpen(i.status)).length}/${items.length}`}
        </Text>
      </View>
      {away ? <Text style={[styles.away, { color: colors.mutedForeground }]}>{away}</Text> : null}
      {items.map((item) => (
        <JohnCard
          key={item.id}
          item={item}
          houseId={context.houseId}
          zone={context.zone}
          now={context.now}
          mine={mine}
          ownerName={name}
          immunityTokens={mine ? immunityTokens : 0}
        />
      ))}
    </View>
  );
}

/** Who's away this week, beside the laptop's board, as the web's aside. */
export function AwayThisWeek({ people, me }: { people: { userId: string; name: string; label: string | null }[]; me: string }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.awayCard}>
      <Eyebrow>{AWAY_COPY.thisWeek}</Eyebrow>
      {people.map((p) => (
        <View key={p.userId} testID="away-this-week" style={styles.awayRow}>
          <Avatar name={p.name} me={p.userId === me} size={24} />
          <Text style={[styles.awayName, { color: colors.foreground }]}>{p.userId === me ? 'You' : firstName(p.name)}</Text>
          <Text style={[styles.awayWhen, { color: colors.mutedForeground }]}>{(p.label ?? '').replace('Away ', '')}</Text>
        </View>
      ))}
    </Card>
  );
}

/** The laptop's board: the whole house in one table, as the web has it. */
export function WeekTable({ context, items }: { context: BoardContext; items: BoardItem[] }) {
  const { colors } = useTheme();
  const head = [styles.th, { color: colors.mutedForeground }];
  return (
    <Card style={styles.table}>
      <View accessibilityLabel={WEEK_COPY.everyJohn} testID="week-table">
        <View style={[styles.tr, styles.thead, { borderBottomColor: colors.foreground }]}>
          <View style={styles.lidCell} />
          <Text style={[head, styles.johnCell]}>{WEEK_COPY.columns.john}</Text>
          <Text style={[head, styles.whoCell]}>{WEEK_COPY.columns.who}</Text>
          <Text style={[head, styles.dueCell]}>{WEEK_COPY.columns.due}</Text>
          <Text style={[head, styles.ptsCell]}>{WEEK_COPY.columns.points}</Text>
          <Text style={[head, styles.statusCell]}>{WEEK_COPY.columns.status}</Text>
          <View style={styles.actionCell} />
        </View>
        {items.map((item, index) => {
          const mine = item.userId === context.userId;
          const name = context.nameOf(item.userId);
          const hazard = item.status === 'overdue' || item.status === 'missed';
          return (
            <View
              key={item.id}
              testID="week-row"
              style={[styles.tr, index < items.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
            >
              {hazard ? (
                <View style={styles.lidCell}>
                  <HazardTape width={8} height="100%" />
                </View>
              ) : (
                <View aria-hidden style={[styles.lidCell, { backgroundColor: lidColour(colors, item.category) }]} />
              )}
              <View style={styles.johnCell}>
                <Text style={[styles.johnName, { color: colors.foreground }]}>{item.name}</Text>
                {item.groupName ? <Body muted style={styles.small}>{item.groupName}</Body> : null}
              </View>
              <View style={[styles.whoCell, styles.who]}>
                <Avatar name={name} me={mine} size={24} />
                <Text style={[styles.cellText, { color: colors.foreground }]}>{mine ? WEEK_COPY.you : firstName(name)}</Text>
              </View>
              <Text style={[styles.cellText, styles.dueCell, { color: colors.mutedForeground }]}>
                {dueLabel(item.dueAt, context.now, context.zone)}
              </Text>
              <Text style={[styles.points, styles.ptsCell, { color: colors.foreground }]}>
                {isOpen(item.status) ? item.points : pointsEarned(item.status, item.points)}
              </Text>
              <View style={styles.statusCell}>
                <StatusChip status={item.status} />
              </View>
              <View style={styles.actionCell}>
                {mine && isOpen(item.status) ? (
                  <CompactTick item={item} houseId={context.houseId} />
                ) : !mine && item.status === 'checking' ? (
                  <DisputeButton houseId={context.houseId} assignmentId={item.id} john={item.name} owner={name} />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/** The laptop's side column of open disputes, with your vote on each that isn't yours. */
export function DisputeList({ context, items }: { context: BoardContext; items: BoardItem[] }) {
  const { colors } = useTheme();
  const disputed = items.filter((i) => i.dispute);
  if (disputed.length === 0) return null;
  return (
    <Card style={styles.disputes}>
      <Eyebrow>{WEEK_COPY.disputes}</Eyebrow>
      {disputed.map((item, index) => {
        const dispute = item.dispute!;
        const mine = item.userId === context.userId;
        return (
          <View
            key={item.id}
            style={[styles.dispute, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1, paddingTop: SPACE.md }]}
          >
            <Text style={[styles.cellText, { color: colors.foreground }]}>
              <Text style={styles.bold}>{mine ? 'Your' : `${firstName(context.nameOf(item.userId))}'s`}</Text>{' '}
              {WEEK_COPY.disputeOn(item.name, dispute.reason)}
            </Text>
            <Body muted style={styles.small}>
              {WEEK_COPY.tally(dispute.uphold, dispute.reject, relative(dispute.closesAt, context.now))}
            </Body>
            {!mine ? <VoteButtons houseId={context.houseId} disputeId={dispute.id} myVote={dispute.myVote} /> : null}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  awayCard: { gap: SPACE.sm },
  awayRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  awayName: { fontFamily: FONT.bold, fontSize: 14 },
  awayWhen: { marginLeft: 'auto', fontFamily: FONT.regular, fontSize: 14 },
  away: { marginTop: -SPACE.xs, fontFamily: FONT.bold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  stat: { flexGrow: 1, paddingVertical: SPACE.md, gap: 2 },
  statValue: { fontFamily: FONT.black, fontSize: 24 },
  section: { gap: SPACE.md },
  person: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  personName: { fontFamily: FONT.extrabold, fontSize: 16 },
  count: { marginLeft: 'auto', fontFamily: FONT.medium, fontSize: 14 },
  table: { padding: 0, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  thead: { borderBottomWidth: 2 },
  th: { fontFamily: FONT.bold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', paddingVertical: SPACE.sm },
  lidCell: { width: 8, alignSelf: 'stretch' },
  johnCell: { flex: 2, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  whoCell: { width: 120, paddingHorizontal: SPACE.md },
  who: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  dueCell: { width: 150, paddingHorizontal: SPACE.md },
  ptsCell: { width: 48, paddingHorizontal: SPACE.md, textAlign: 'right' },
  statusCell: { width: 170, paddingHorizontal: SPACE.md },
  actionCell: { width: 150, paddingHorizontal: SPACE.md, alignItems: 'flex-end' },
  johnName: { fontFamily: FONT.bold, fontSize: 14 },
  cellText: { fontFamily: FONT.regular, fontSize: 14 },
  points: { fontFamily: FONT.bold, fontSize: 14 },
  small: { fontSize: 12 },
  bold: { fontFamily: FONT.bold },
  disputes: { gap: SPACE.md },
  dispute: { gap: SPACE.sm },
});
