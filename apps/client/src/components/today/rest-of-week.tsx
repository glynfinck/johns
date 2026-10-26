import {
  FOCUS_SHELL_COPY,
  JOHN_COPY,
  myJohnRow,
  NEXT_UP_COPY,
  pointsLabel,
  type BoardItem,
  type HouseRules,
} from '@app/core';
import { ShieldIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';

import type { Housemate } from '@/api/board';
import { undoDone } from '@/api/johns';
import { Alert } from '@/components/alert';
import { Fold } from '@/components/fold';
import { GroupItem } from '@/components/group';
import { useJohnSheet } from '@/components/john-sheet';
import { Row, RowIcon } from '@/components/row';
import { Section } from '@/components/section';
import { StatusMark } from '@/components/status-mark';
import { TextButton } from '@/components/text-button';
import { TickCircle } from '@/components/tick-circle';
import { useMove } from '@/hooks/use-move';
import { useTick } from '@/hooks/use-tick';

/**
 * The rest of your week: your other Johns as rows, ticked from their
 * circle, and the finished ones folded into "Done (n)". Nothing when there
 * are none.
 */
export function RestOfWeek({
  houseId,
  going,
  finished,
  members,
  rules,
  now,
}: {
  houseId: string;
  going: BoardItem[];
  finished: BoardItem[];
  members: Housemate[];
  rules: HouseRules;
  now: Date;
}) {
  if (going.length === 0 && finished.length === 0) return null;
  const row = (item: BoardItem) => <MyJohnRow key={item.id} houseId={houseId} item={item} members={members} rules={rules} now={now} />;
  return (
    <Section label={NEXT_UP_COPY.rest} testID="rest-of-week">
      {going.map(row)}
      {finished.length > 0 ? (
        <Fold label={FOCUS_SHELL_COPY.done(finished.length)} testID="done-fold">
          {finished.map(row)}
        </Fold>
      ) : null}
    </Section>
  );
}

/**
 * One of your Johns, as core's myJohnRow plans it: the circle ticks it
 * while it's to do (a photo John opens the camera first); while the house
 * checks it, Undo is its one trailing item, and otherwise its points or
 * where it has got to, never both. The row opens the John sheet. A refusal
 * is said under it.
 */
function MyJohnRow({
  houseId,
  item,
  members,
  rules,
  now,
}: {
  houseId: string;
  item: BoardItem;
  members: Housemate[];
  rules: HouseRules;
  now: Date;
}) {
  const sheet = useJohnSheet();
  const tick = useTick(houseId, item.id);
  const undo = useMove(houseId);
  const plan = myJohnRow(item, members, rules, now);
  const problem = tick.problem ?? undo.problem;

  const leading =
    plan.circle === 'tick' ? (
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

  let trailing: ReactNode = null;
  if (plan.trailing === 'undo') {
    trailing = (
      <TextButton
        label={JOHN_COPY.undo}
        align="end"
        disabled={undo.pending}
        accessibilityLabel={NEXT_UP_COPY.undo(item.name)}
        onPress={() => void undo.run(() => undoDone(item.id))}
      />
    );
  } else if (plan.trailing === 'points') {
    trailing = pointsLabel(item.points);
  } else if (plan.trailing === 'status') {
    trailing = <StatusMark status={item.status} />;
  }

  return (
    <>
      <Row
        leading={leading}
        title={item.name}
        lid={plan.lid ? item.category : undefined}
        meta={plan.meta}
        trailing={trailing}
        hazardEdge={plan.hazardEdge}
        onPress={() => sheet.open(item.id)}
        testID="my-john"
      />
      {problem ? (
        <GroupItem>
          <Alert message={problem} />
        </GroupItem>
      ) : null}
    </>
  );
}
