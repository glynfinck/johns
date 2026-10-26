import {
  CATEGORY_LABEL,
  dueLabel,
  isOpen,
  pointsLabel,
  STATUS_MARK,
  type BoardItem,
  type Category,
  type HouseRules,
  type WeekBoard,
} from '@app/core';
import { StyleSheet, View } from 'react-native';

import type { Housemate } from '@/api/board';
import { DisputeNote, DueBeforeYouGo, StandsActions, TickActions } from '@/components/john-card';
import { LidDot } from '@/components/lid';
import { Lead, Meta } from '@/components/text';
import { INSET, SPACE } from '@/theme';

/**
 * What the John sheet was opened to do first, when it was opened for
 * something in particular: the vote (Today's "Needs you"), a dispute (a
 * housemate's fresh tick on Week), "If you can't" (Today's "Skip with
 * immunity or swap ›"), or the swap itself.
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
  /** You in this house: your role and your tokens. */
  me: Housemate | null;
  /** This week's board, live: the other side of a swap, the house's open Johns. */
  board: WeekBoard;
  /** What it was opened for (Today's "Needs you" opens it on the vote). */
  focus: JohnSheetFocus | null;
  /** Put the sheet away (after a vote, say). */
  close: () => void;
}

/**
 * The John sheet's content for one John, live: its header, then what can be
 * done with it from here. The Today track builds the final states here
 * (yours open, being checked, a housemate's tick, a dispute, settled); for
 * now it holds the actions JohnCard has.
 */
export function JohnSheetBody({ item, context }: { item: BoardItem; context: JohnSheetContext }) {
  const { houseId, userId, zone, now, nameOf, me } = context;
  const mine = item.userId === userId;
  const ownerName = nameOf(item.userId);
  return (
    <View style={styles.body} testID="john-sheet-body">
      <JohnSheetHeader item={item} zone={zone} now={now} />
      <DueBeforeYouGo item={item} zone={zone} now={now} mine={mine} ownerName={ownerName} />
      <DisputeNote item={item} houseId={houseId} now={now} mine={mine} />
      {mine && isOpen(item.status) ? (
        <TickActions item={item} houseId={houseId} immunityTokens={me?.immunityTokens ?? 0} />
      ) : null}
      {item.status === 'checking' ? (
        <StandsActions item={item} houseId={houseId} now={now} mine={mine} ownerName={ownerName} inline />
      ) : null}
    </View>
  );
}

/**
 * The sheet's head: the lid dot before the category (then the group, if it
 * has one) and the points; the John's name in full as the Lead; when it's
 * due and where it has got to, in words. The sheet sits on the pavement, so
 * no hazard words or chips here: those go in a group below.
 */
export function JohnSheetHeader({ item, zone, now }: { item: BoardItem; zone: string; now: Date }) {
  const category = CATEGORY_LABEL[item.category as Category] ?? CATEGORY_LABEL.other;
  const kind = [category, item.groupName, pointsLabel(item.points)].filter(Boolean).join(' · ');
  const mark = STATUS_MARK[item.status];
  const when = [dueLabel(item.dueAt, now, zone), mark.tone === 'none' ? null : mark.label].filter(Boolean).join(' · ');
  return (
    <View style={styles.header}>
      <View style={styles.metaLine}>
        <LidDot category={item.category} />
        <Meta numberOfLines={1} style={styles.shrink}>
          {kind}
        </Meta>
      </View>
      <Lead header testID="john-sheet-name">
        {item.name}
      </Lead>
      <Meta testID="john-sheet-when">{when}</Meta>
    </View>
  );
}

const styles = StyleSheet.create({
  // The flush sheet sets content at the gutter; the John's words and buttons sit on the leading edge.
  body: { paddingHorizontal: INSET, gap: SPACE.lg },
  header: { gap: SPACE.xs },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
});
