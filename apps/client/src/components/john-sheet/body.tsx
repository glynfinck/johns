import {
  forfeitRoom,
  johnSheetMode,
  monthOf,
  sheetCadence,
  sheetKind,
  sheetWhen,
  type BoardItem,
  type HouseRules,
  type StakeView,
  type WeekBoard,
} from '@app/core';
import { FlagIcon, TriangleAlertIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import type { Housemate } from '@/api/board';
import type { JohnList } from '@/api/settings';
import { LidDot } from '@/components/lid';
import { Lead, Meta } from '@/components/text';
import { listKey } from '@/hooks/keys';
import { INSET, SPACE, useTheme } from '@/theme';

import { useCached } from './cached';
import { TheirsChecking, YoursChecking } from './checking';
import { TheirsOpen, YoursOpen } from './open';
import { Settled } from './settled';
import { Disputed } from './vote';

/**
 * What the John sheet was opened for, when it was opened for something in
 * particular: the vote (Today's "Needs you"), a dispute (a housemate's
 * fresh tick on Week: the sheet shows its outline Dispute, and never opens
 * the form, keyboard and all, by itself), "If you can't" (Today's "Skip
 * with immunity ›" opens on the skip's sentence, ready to confirm), or the
 * swap itself.
 */
export type JohnSheetFocus = 'vote' | 'dispute' | 'cant' | 'swap';

/** Everything the John sheet's body knows besides the John: who's looking, the house, and the moment. */
export interface JohnSheetContext {
  houseId: string;
  /** Who's looking. */
  userId: string;
  /** The house's time zone (also `rules.timezone`). */
  zone: string;
  /** The house's rules: the currency, the stake and what late and missed cost. */
  rules: HouseRules;
  now: Date;
  /** Anyone's name by id; "A former housemate" for someone who has left. */
  nameOf: (userId: string) => string;
  /** Who lives here, for the sentences that name them. */
  members: Housemate[];
  /** You in this house: your role and your tokens. */
  me: Housemate | null;
  /** This week's board, live: the other side of a swap, the house's open Johns. */
  board: WeekBoard;
  /** The Stake, when a screen has read it: it caps what lateness costs. */
  stake: StakeView | null;
  /** What it was opened for (Today's "Needs you" opens it on the vote). */
  focus: JohnSheetFocus | null;
  /** Put the sheet away (after a vote, say). */
  close: () => void;
}

/**
 * The John sheet's content for one John, live: its header, then what can
 * be done with it from here, by whose it is and where it has got to (core's
 * johnSheetMode). Yours and open: the tick, and "If you can't" while you
 * hold a token. Being checked: when it stands, and Undo for yours or
 * Dispute for a housemate's. Disputed: the reason, the tally and the vote.
 * Settled: what happened, and the photo.
 */
export function JohnSheetBody({ item, context }: { item: BoardItem; context: JohnSheetContext }) {
  const everyWeeks = useCadence(context.houseId, item);
  return (
    <View testID="john-sheet-body">
      <JohnSheetHeader item={item} context={context} everyWeeks={everyWeeks} />
      <ModeContent item={item} context={context} />
    </View>
  );
}

function ModeContent({ item, context }: { item: BoardItem; context: JohnSheetContext }) {
  switch (johnSheetMode(item, context.userId)) {
    case 'yours-open':
      return <YoursOpen item={item} context={context} />;
    case 'theirs-open':
      return <TheirsOpen item={item} context={context} />;
    case 'yours-checking':
      return <YoursChecking item={item} context={context} />;
    case 'theirs-checking':
      return <TheirsChecking item={item} context={context} />;
    case 'yours-disputed':
    case 'theirs-disputed':
      return <Disputed item={item} context={context} />;
    case 'settled':
      return <Settled item={item} context={context} />;
  }
}

/** How often the John comes round, from the house's list when a screen has read it (Today does). */
function useCadence(houseId: string, item: BoardItem): number | null {
  const list = useCached<JohnList>(listKey(houseId));
  return list ? sheetCadence(item, list.johns) : null;
}

/**
 * The sheet's head: the lid dot before the kind, then the group, the
 * points and how often; the John's name in full as the Lead; when it's due
 * and what lateness costs its owner (capped at what's left of their stake,
 * once the Stake is read). The sheet sits on the pavement, so overdue and
 * disputed are said in ink after a hazard sign, never in hazard words.
 */
export function JohnSheetHeader({
  item,
  context,
  everyWeeks = null,
}: {
  item: BoardItem;
  context: JohnSheetContext;
  everyWeeks?: number | null;
}) {
  const { colors, type } = useTheme();
  const room = forfeitRoom(context.stake, item.userId, monthOf(item.dueAt, context.zone));
  const when = sheetWhen(item, context.members, context.rules, context.now, room);
  const Sign = when.sign === 'overdue' ? TriangleAlertIcon : when.sign === 'disputed' ? FlagIcon : null;
  return (
    <View style={styles.header}>
      <View style={styles.line}>
        <LidDot category={item.category} />
        <Meta numberOfLines={1} style={styles.shrink}>
          {sheetKind(item, everyWeeks)}
        </Meta>
      </View>
      <Lead header testID="john-sheet-name">
        {item.name}
      </Lead>
      <View style={styles.line}>
        {Sign ? <Sign size={16} color={colors.hazard} aria-hidden /> : null}
        <Text style={[type.meta, styles.shrink, Sign ? { color: colors.foreground } : null]} testID="john-sheet-when">
          {when.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The flush sheet sets content at the gutter; the John's words sit on the leading edge.
  header: { paddingHorizontal: INSET, gap: SPACE.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
});
