import { FOCUS_SHELL_COPY, NEXT_UP_COPY, voteMeta, voteTitle, type BoardItem } from '@app/core';

import type { Housemate } from '@/api/board';
import { Avatar } from '@/components/avatar';
import { useJohnSheet } from '@/components/john-sheet';
import { Row } from '@/components/row';
import { Section } from '@/components/section';

/**
 * Needs you: one row per dispute waiting for your vote ("Vote on Priya's
 * Clean the bathroom"), the John's owner in the leading slot, opening the
 * John sheet at the vote. Nothing when nothing waits (always, in a house
 * of one).
 */
export function NeedsYou({ items, members, now }: { items: BoardItem[]; members: Housemate[]; now: Date }) {
  const sheet = useJohnSheet();
  if (items.length === 0) return null;
  return (
    <Section label={NEXT_UP_COPY.needsYou} count={items.length} testID="needs-you">
      {items.map((item) => (
        <Row
          key={item.id}
          leading={<Avatar name={members.find((m) => m.userId === item.userId)?.name ?? FOCUS_SHELL_COPY.formerHousemate} />}
          title={voteTitle(item, members)}
          meta={item.dispute ? voteMeta(item.dispute, members, now) : undefined}
          chevron
          onPress={() => sheet.open(item.id, 'vote')}
          testID="vote-row"
        />
      ))}
    </Section>
  );
}
