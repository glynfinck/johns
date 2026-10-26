import {
  REACTION_LABEL,
  struckAt,
  WALL_COPY,
  WALL_FEED_COPY,
  type ReactionKind,
  type StatusIcon,
  type WallEvent,
  type WallFeedRow,
  type WallIcon,
  type WallScene,
} from '@app/core';
import {
  BadgeCheckIcon,
  BanknoteIcon,
  CalendarCheckIcon,
  CheckIcon,
  EyeIcon,
  FlagIcon,
  FlameIcon,
  GavelIcon,
  PlaneIcon,
  RepeatIcon,
  ShieldIcon,
  SmilePlusIcon,
  SparklesIcon,
  ThumbsUpIcon,
  UserPlusIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { GroupItem } from '@/components/group';
import { Row, RowIcon } from '@/components/row';
import { STATUS_ICON } from '@/components/status-mark';
import { Meta } from '@/components/text';
import type { HouseView } from '@/hooks/use-house';
import { INSET, LEADING, RADIUS, ROW_GAP, SPACE, TAP, useTheme } from '@/theme';

// Core says what happened and which icon fits; these draw it.
const WALL_ICON: Record<WallIcon, LucideIcon> = {
  check: CheckIcon,
  x: XIcon,
  flag: FlagIcon,
  gavel: GavelIcon,
  shield: ShieldIcon,
  repeat: RepeatIcon,
  plane: PlaneIcon,
  'user-plus': UserPlusIcon,
  'calendar-check': CalendarCheckIcon,
  banknote: BanknoteIcon,
  'badge-check': BadgeCheckIcon,
};

/** Icons, not emoji: the house style has none. */
export const REACTION_ICON: Record<ReactionKind, LucideIcon> = {
  nice: ThumbsUpIcon,
  fire: FlameIcon,
  sparkle: SparklesIcon,
  eyes: EyeIcon,
};

/**
 * What the Wall's rows need from the house: who's looking, who lives here,
 * its clock, where this week's Johns have got to, and which ticks among
 * `events` the house struck out. `clock` sets the time as "14:10" (the
 * whole Wall, by day) rather than "3h" (House).
 */
export function wallScene(view: HouseView, userId: string, events: readonly WallEvent[], clock = false): WallScene {
  const status = new Map(view.board.items.map((item) => [item.id, item.status]));
  return {
    me: userId,
    members: view.snapshot.members,
    currency: view.snapshot.rules.currency,
    zone: view.snapshot.rules.timezone,
    now: view.now,
    statusOf: (id) => status.get(id),
    struck: struckAt(events),
    clock,
  };
}

/**
 * One thing the house did, as a row: whoever did it leads (an icon for the
 * house's own news), one sentence, and the meta line's words with the time,
 * which always shows. Tapping it (`onPress`) opens this week's John in the
 * John sheet, or else the event in full; holding it down (`onReactions`)
 * shows the event with all four reactions. Where an event takes reactions,
 * its trailing item is a control of its own, so the reactions are a key
 * press away too: a housemate's tick trails the "Nice one" toggle with the
 * way to all four beside it; anything else, what the house gave it most,
 * or, on a row whose tap opens the John, a way to react at all. `problem`
 * is a reaction's refusal, said under the row it was made on. A John that
 * went wrong wears its status mark, as everywhere else.
 */
export function WallEventRow({
  row,
  problem,
  onReact,
  onPress,
  onReactions,
}: {
  row: WallFeedRow;
  problem?: string | null;
  onReact: (kind: ReactionKind, on: boolean) => void;
  onPress: () => void;
  onReactions: () => void;
}) {
  const nice = row.reactions.nice;
  let trailing = null;
  if (row.reactable && row.nice) {
    trailing = (
      <View style={styles.pair}>
        <ReactButton compact onPress={onReactions} />
        <NiceToggle count={nice.count} mine={nice.mine} onPress={() => onReact('nice', !nice.mine)} onLongPress={onReactions} />
      </View>
    );
  } else if (row.reactable && row.top) {
    trailing = <ReactionTally kind={row.top.kind} count={row.top.count} onPress={onReactions} />;
  } else if (row.reactable && row.board) {
    trailing = <ReactButton onPress={onReactions} />;
  }
  return (
    <>
      <Row
        leading={row.actor ? <Avatar name={row.actor.name} me={row.actor.me} /> : <RowIcon icon={WALL_ICON[row.icon]} />}
        title={row.title}
        // A sentence: two lines, so it isn't cut off mid-way.
        titleLines={2}
        meta={<WallMeta detail={row.detail} mark={row.mark} when={row.when} />}
        trailing={trailing}
        trailingControl
        onPress={onPress}
        onLongPress={onReactions}
        accessibilityLabel={row.label}
        testID="wall-event"
      />
      {problem ? (
        <GroupItem>
          <Alert message={problem} />
        </GroupItem>
      ) : null}
    </>
  );
}

/**
 * The meta line: the words truncate, the time after them never does. A
 * John that went wrong (`mark`) leads with its status mark, its words in
 * hazard on the card colour.
 */
function WallMeta({ detail, mark, when }: { detail: string | null; mark: StatusIcon | null; when: string }) {
  const { colors } = useTheme();
  const Mark = mark ? STATUS_ICON[mark] : null;
  return (
    <View style={styles.meta}>
      {Mark ? <Mark size={14} color={colors.hazard} aria-hidden style={styles.mark} /> : null}
      {detail ? (
        <Meta numberOfLines={1} style={[styles.detail, Mark && { color: colors.hazard }]}>
          {detail}
        </Meta>
      ) : null}
      {/* A no-break space: a browser drops an ordinary one at the start of a line of its own. */}
      <Meta numberOfLines={1} style={styles.when}>
        {detail ? `\u00a0· ${when}` : when}
      </Meta>
    </View>
  );
}

/** A toggle's state, as each platform hears it: pressed in a browser, selected on a phone, which has no pressed. */
function toggleState(on: boolean): object {
  return Platform.OS === 'web' ? { 'aria-pressed': on } : { 'aria-selected': on };
}

/**
 * A reaction's count beside its icon, or, before anyone gives it, the room
 * for one, so the icons down a group stay in one column.
 */
function Count({ count, color }: { count: number; color: string }) {
  if (count > 0) return <Meta style={{ color }}>{count}</Meta>;
  return (
    <View aria-hidden style={styles.room}>
      <Meta>0</Meta>
    </View>
  );
}

/**
 * The "Nice one" toggle a housemate's tick carries: borderless, the thumb
 * and how many gave it, muted until it's yours, then ink on the tint.
 * Holding it down shows all four, as holding the row does.
 */
export function NiceToggle({
  count,
  mine,
  onPress,
  onLongPress,
}: {
  count: number;
  mine: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();
  const ink = mine ? colors.foreground : colors.mutedForeground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? WALL_FEED_COPY.tally(REACTION_LABEL.nice, count) : REACTION_LABEL.nice}
      {...toggleState(mine)}
      onPress={onPress}
      onLongPress={onLongPress}
      testID="nice-one"
      style={({ pressed }) => [styles.pill, { backgroundColor: mine || pressed ? colors.secondary : 'transparent' }]}
    >
      <ThumbsUpIcon size={20} color={ink} aria-hidden />
      <Count count={count} color={ink} />
    </Pressable>
  );
}

/** What the house gave an event most, in the toggle's place: pressing it shows all four. */
export function ReactionTally({ kind, count, onPress }: { kind: ReactionKind; count: number; onPress: () => void }) {
  const { colors } = useTheme();
  const Icon = REACTION_ICON[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={WALL_FEED_COPY.tally(REACTION_LABEL[kind], count)}
      onPress={onPress}
      testID="reaction-tally"
      style={({ pressed }) => [styles.pill, pressed && { backgroundColor: colors.secondary }]}
    >
      <Icon size={20} color={colors.mutedForeground} aria-hidden />
      <Count count={count} color={colors.mutedForeground} />
    </Pressable>
  );
}

/**
 * The way to all four reactions on a row whose tap opens its John instead:
 * on its own where nobody has reacted yet, or `compact` (no room for a
 * count, kept clear of the row's edge) beside a "Nice one" toggle.
 */
export function ReactButton({ onPress, compact = false }: { onPress: () => void; compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={WALL_FEED_COPY.react}
      onPress={onPress}
      testID="react"
      style={({ pressed }) => [compact ? styles.compact : styles.pill, pressed && { backgroundColor: colors.secondary }]}
    >
      <SmilePlusIcon size={20} color={colors.mutedForeground} aria-hidden />
      {compact ? null : <Count count={0} color={colors.mutedForeground} />}
    </Pressable>
  );
}

/** A tick's photo receipt, under its row and in line with its words. */
export function WallPhoto({ uri, john }: { uri: string; john: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={styles.photoRow}>
      <Image
        source={{ uri }}
        accessibilityLabel={WALL_COPY.photoOf(john ?? WALL_FEED_COPY.theJohn)}
        resizeMode="cover"
        style={[styles.photo, { backgroundColor: colors.secondary }]}
        testID="wall-photo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  mark: { marginRight: SPACE.xs, flexShrink: 0 },
  detail: { flexShrink: 1 },
  when: { flexShrink: 0 },
  // The icon and its count end at the row's trailing edge, the room for a
  // count kept, so the icons down a group line up.
  pill: {
    minHeight: TAP,
    minWidth: TAP,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingHorizontal: 10,
    marginRight: -SPACE.sm,
    borderRadius: RADIUS,
  },
  compact: { minHeight: TAP, minWidth: TAP, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS },
  pair: { flexDirection: 'row', alignItems: 'center' },
  room: { opacity: 0 },
  photoRow: { paddingLeft: INSET + LEADING + ROW_GAP, paddingRight: INSET, paddingBottom: SPACE.md },
  photo: { width: '100%', maxWidth: 320, aspectRatio: 4 / 3, borderRadius: RADIUS },
});
