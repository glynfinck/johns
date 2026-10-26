import {
  doneFold,
  JOHN_COPY,
  johnRow,
  NEXT_UP_COPY,
  pointsLabel,
  WEEK_SUMMARY_COPY,
  type BoardItem,
  type JohnRowPlan,
} from '@app/core';
import { ClockIcon, ShieldIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { undoDone } from '@/api/johns';
import { Alert } from '@/components/alert';
import { Fold } from '@/components/fold';
import { GroupItem } from '@/components/group';
import { useJohnSheet } from '@/components/john-sheet';
import { Row, RowIcon } from '@/components/row';
import { StatusMark } from '@/components/status-mark';
import { Body } from '@/components/text';
import { TextButton } from '@/components/text-button';
import { TickCircle } from '@/components/tick-circle';
import { useMove } from '@/hooks/use-move';
import { useTick } from '@/hooks/use-tick';
import { FONT, SPACE, useTheme } from '@/theme';

/** Who's looking, and how to name everyone: what every John's row needs. */
export interface JohnRowContext {
  houseId: string;
  userId: string;
  zone: string;
  now: Date;
  /** Anyone's full name by id, or null for someone who has left. */
  nameOf: (userId: string) => string | null;
}

/**
 * One John as a row, wherever it's drawn (Today, Week's groups and its
 * table): its plan from core's johnRow (what the circle shows and whether
 * it ticks, the meta line, the one trailing item, what the sheet opens on),
 * the circle, the trailing item, and opening its John sheet. `problem` is
 * the refusal of a tick or an undo made here.
 */
export function useJohnRow(item: BoardItem, context: JohnRowContext) {
  const sheet = useJohnSheet();
  const tick = useTick(context.houseId, item.id);
  const undo = useMove(context.houseId);
  const plan = johnRow(item, context.userId, context.now, context.zone, context.nameOf);
  const open = () => sheet.open(item.id, plan.focus ?? undefined);

  // A photo John's circle goes to the camera (the file chooser, on the web) first.
  const leading = plan.ticks ? (
    <TickCircle
      state={tick.busy ? 'busy' : 'open'}
      label={plan.circleLabel}
      onPress={() => void (item.needsPhoto ? tick.tickWithPhoto('camera') : tick.tick())}
    />
  ) : plan.circle === 'excused' ? (
    <RowIcon icon={ShieldIcon} />
  ) : (
    <TickCircle state={plan.circle} label={plan.circleLabel} />
  );

  return {
    plan,
    open,
    leading,
    trailing: trailingFor(plan, item, {
      undo: () => void undo.run(() => undoDone(item.id)),
      undoing: undo.pending,
      vote: open,
    }),
    problem: tick.problem ?? undo.problem,
  };
}

/** The row's one trailing item, from its plan. */
function trailingFor(
  plan: JohnRowPlan,
  item: BoardItem,
  moves: { undo: () => void; undoing: boolean; vote: () => void },
): ReactNode {
  switch (plan.trailing) {
    case 'undo':
      return (
        <TextButton
          label={JOHN_COPY.undo}
          align="end"
          accessibilityLabel={NEXT_UP_COPY.undo(item.name)}
          disabled={moves.undoing}
          onPress={moves.undo}
        />
      );
    case 'vote':
      return (
        <TextButton
          label={WEEK_SUMMARY_COPY.vote}
          chevron
          align="end"
          accessibilityLabel={WEEK_SUMMARY_COPY.voteOn(item.name)}
          onPress={moves.vote}
        />
      );
    case 'points':
      return pointsLabel(plan.points);
    case 'status':
      return <StatusMark status={item.status} />;
    default:
      return null;
  }
}

/**
 * A John as a row: the circle (yours ticks from it), the name, the meta
 * line, and one trailing item; the 4pt hazard edge when it's overdue or
 * missed. Tapping it opens the John sheet. A refusal shows under it, where
 * the move was made.
 */
export function JohnRow({ item, context, testID }: { item: BoardItem; context: JohnRowContext; testID: string }) {
  const john = useJohnRow(item, context);
  return (
    <>
      <Row
        title={item.name}
        meta={john.plan.meta}
        lid={john.plan.lid ? item.category : undefined}
        leading={john.leading}
        trailing={john.trailing}
        hazardEdge={john.plan.hazardEdge}
        onPress={john.open}
        testID={testID}
      />
      {john.problem ? (
        <GroupItem>
          <Alert message={john.problem} />
        </GroupItem>
      ) : null}
    </>
  );
}

/**
 * Finished Johns, folded away at the end of a group: "Done (2)", then how
 * many of those were late in hazard words after late's clock. Nothing when
 * there are none.
 */
export function DoneFold({ items, children }: { items: readonly BoardItem[]; children: ReactNode }) {
  const { colors } = useTheme();
  if (items.length === 0) return null;
  const fold = doneFold(items);
  return (
    <Fold
      label={fold.label}
      meta={
        fold.late ? (
          <View style={styles.late}>
            <ClockIcon size={16} color={colors.hazard} aria-hidden />
            <Body numberOfLines={1} style={[styles.lateWords, { color: colors.hazard }]}>
              {fold.late}
            </Body>
          </View>
        ) : undefined
      }
      testID="done-fold"
    >
      {children}
    </Fold>
  );
}

const styles = StyleSheet.create({
  late: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  lateWords: { fontFamily: FONT.bold },
});
