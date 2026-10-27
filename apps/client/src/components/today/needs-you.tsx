import { coverTitle, FOCUS_SHELL_COPY, johnRow, NEXT_UP_COPY, voteMeta, voteTitle, type BoardItem } from '@app/core';

import type { Housemate } from '@/api/board';
import { Avatar } from '@/components/avatar';
import { useJohnSheet } from '@/components/john-sheet';
import { Row } from '@/components/row';
import { Section } from '@/components/section';

/**
 * Needs you: one row per dispute waiting for your vote ("Vote on Priya's
 * Clean the bathroom"), then one per housemate's John overdue past the
 * grace that you could cover ("Cover Sam's Bins", "Bins · was due Tue"),
 * the John's owner in the leading slot, opening the John sheet at the vote
 * or at "I did this". Nothing when nothing waits (always, in a house of
 * one).
 */
export function NeedsYou({
  items,
  toCover = [],
  members,
  userId,
  zone,
  now,
}: {
  items: BoardItem[];
  toCover?: BoardItem[];
  members: Housemate[];
  userId: string;
  zone: string;
  now: Date;
}) {
  const sheet = useJohnSheet();
  const total = items.length + toCover.length;
  if (total === 0) return null;
  const nameOf = (id: string) => members.find((m) => m.userId === id)?.name ?? null;
  return (
    <Section label={NEXT_UP_COPY.needsYou} count={total} testID="needs-you">
      {items.map((item) => (
        <Row
          key={item.id}
          leading={<Avatar name={members.find((m) => m.userId === item.userId)?.name ?? FOCUS_SHELL_COPY.formerHousemate} />}
          title={voteTitle(item, members)}
          // The John's name is never cut short.
          titleLines={2}
          meta={item.dispute ? voteMeta(item.dispute, members, now) : undefined}
          chevron
          onPress={() => sheet.open(item.id, 'vote')}
          testID="vote-row"
        />
      ))}
      {toCover.map((item) => (
        <Row
          key={item.id}
          leading={<Avatar name={nameOf(item.userId) ?? FOCUS_SHELL_COPY.formerHousemate} />}
          title={coverTitle(item, members)}
          titleLines={2}
          meta={johnRow(item, userId, now, zone, nameOf).meta}
          chevron
          hazardEdge
          onPress={() => sheet.open(item.id)}
          testID="cover-row"
        />
      ))}
    </Section>
  );
}
