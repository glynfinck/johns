import { DISPUTE_COPY, JOHN_COPY, tickedLine, type BoardItem } from '@app/core';
import { FlagIcon, Undo2Icon } from 'lucide-react-native';
import { useState } from 'react';

import { undoDone } from '@/api/johns';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { DisputeForm } from '@/components/dispute';
import { Body } from '@/components/text';
import { useMove } from '@/hooks/use-move';

import type { JohnSheetContext } from './body';
import { SheetLines } from './parts';

/** Your tick, being checked: when it stands, and Undo meanwhile. */
export function YoursChecking({ item, context }: { item: BoardItem; context: JohnSheetContext }) {
  const move = useMove(context.houseId);
  return (
    <SheetLines>
      <Body testID="ticked-line">{tickedLine(item, context.members, context.userId, context.rules, context.now)}</Body>
      <Button
        variant="outline"
        icon={Undo2Icon}
        label={JOHN_COPY.undo}
        disabled={move.pending}
        onPress={() => void move.run(() => undoDone(item.id))}
        testID="sheet-undo"
      />
      {move.problem ? <Alert message={move.problem} /> : null}
    </SheetLines>
  );
}

/**
 * A housemate's fresh tick: who ticked it and when it stands, and an
 * outline Dispute, which opens "What's wrong with it" and "Put it to the
 * house" in place. Only that press opens the form (and its keyboard), even
 * when the sheet was opened to dispute: most who look are just looking.
 */
export function TheirsChecking({ item, context }: { item: BoardItem; context: JohnSheetContext }) {
  const [disputing, setDisputing] = useState(false);
  return (
    <SheetLines>
      <Body testID="ticked-line">{tickedLine(item, context.members, context.userId, context.rules, context.now)}</Body>
      {disputing ? (
        <DisputeForm houseId={context.houseId} assignmentId={item.id} />
      ) : (
        <Button variant="outline" icon={FlagIcon} label={DISPUTE_COPY.open} onPress={() => setDisputing(true)} testID="dispute" />
      )}
    </SheetLines>
  );
}
