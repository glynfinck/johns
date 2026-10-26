import {
  JOHN_COPY,
  pointsLabel,
  WEEK_SUMMARY_COPY,
  weekRowMeta,
  weekRowPlan,
  type BoardItem,
  type WeekRowPlan,
} from '@app/core';
import { ShieldIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { undoDone } from '@/api/johns';
import { Alert } from '@/components/alert';
import { GroupItem } from '@/components/group';
import { useJohnSheet } from '@/components/john-sheet';
import { Row, RowIcon } from '@/components/row';
import { StatusMark } from '@/components/status-mark';
import { TextButton } from '@/components/text-button';
import { TickCircle } from '@/components/tick-circle';
import { useMove } from '@/hooks/use-move';
import { useTick } from '@/hooks/use-tick';

/** Who's looking at the week, and how to name everyone in it: what every John on Week needs. */
export interface WeekContext {
  houseId: string;
  userId: string;
  zone: string;
  now: Date;
  /** Anyone's full name by id, or null for someone who has left. */
  nameOf: (userId: string) => string | null;
}

/**
 * One John on Week, as both widths draw it: its plan from core (what the
 * circle shows and whether it ticks, the one trailing item, what the sheet
 * opens on), its meta line, the circle, the trailing item, and opening its
 * John sheet. `problem` is the refusal of a tick or an undo made here.
 */
export function useWeekJohn(item: BoardItem, context: WeekContext) {
  const sheet = useJohnSheet();
  const tick = useTick(context.houseId, item.id);
  const undo = useMove(context.houseId);
  const plan = weekRowPlan(item, context.userId);
  const meta = weekRowMeta(item, context.userId, context.now, context.zone, context.nameOf);
  const open = () => sheet.open(item.id, plan.focus ?? undefined);

  // A photo John's circle goes to the camera (the file chooser, on the web) first.
  const leading = plan.ticks ? (
    <TickCircle
      state={tick.busy ? 'busy' : 'open'}
      label={WEEK_SUMMARY_COPY.markDone(item.name)}
      onPress={() => void (item.needsPhoto ? tick.tickWithPhoto('camera') : tick.tick())}
    />
  ) : plan.circle === 'excused' ? (
    <RowIcon icon={ShieldIcon} />
  ) : (
    <TickCircle state={plan.circle} label={plan.circleLabel} />
  );

  return {
    plan,
    meta,
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
  plan: WeekRowPlan,
  item: BoardItem,
  moves: { undo: () => void; undoing: boolean; vote: () => void },
): ReactNode {
  switch (plan.trailing) {
    case 'undo':
      return (
        <TextButton
          label={JOHN_COPY.undo}
          align="end"
          accessibilityLabel={WEEK_SUMMARY_COPY.undo(item.name)}
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
    default:
      return <StatusMark status={item.status} />;
  }
}

/**
 * A John as a row in its owner's group: the circle (yours ticks from it),
 * the name, the meta line, and one trailing item; the 4pt hazard edge when
 * it's overdue or missed. Tapping it opens the John sheet. A refusal shows
 * under it, where the move was made.
 */
export function WeekJohnRow({ item, context }: { item: BoardItem; context: WeekContext }) {
  const john = useWeekJohn(item, context);
  return (
    <>
      <Row
        title={item.name}
        meta={john.meta.text}
        lid={john.meta.lid ? item.category : undefined}
        leading={john.leading}
        trailing={john.trailing}
        hazardEdge={john.plan.hazardEdge}
        onPress={john.open}
        testID="week-row"
      />
      {john.problem ? (
        <GroupItem>
          <Alert message={john.problem} />
        </GroupItem>
      ) : null}
    </>
  );
}
