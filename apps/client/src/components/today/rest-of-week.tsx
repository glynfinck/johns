import { NEXT_UP_COPY, type BoardItem } from '@app/core';

import { DoneFold, JohnRow, type JohnRowContext } from '@/components/john-row';
import { Section } from '@/components/section';

/**
 * The rest of your week: your other Johns as rows, the same rows Week draws
 * (ticked from their circle, Undo while the house checks one), and the
 * finished ones folded into "Done (n)". Nothing when there are none.
 */
export function RestOfWeek({ going, finished, context }: { going: BoardItem[]; finished: BoardItem[]; context: JohnRowContext }) {
  if (going.length === 0 && finished.length === 0) return null;
  const row = (item: BoardItem) => <JohnRow key={item.id} item={item} context={context} testID="my-john" />;
  return (
    <Section label={NEXT_UP_COPY.rest} testID="rest-of-week">
      {going.map(row)}
      <DoneFold items={finished}>{finished.map(row)}</DoneFold>
    </Section>
  );
}
