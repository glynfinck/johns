import {
  FOCUS_SHELL_COPY,
  WEEK_SUMMARY_COPY,
  weekFold,
  weekPersonMeta,
  weekWho,
  type BoardItem,
  type WeekPerson,
} from '@app/core';
import { RepeatIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Fold } from '@/components/fold';
import { Group, GroupItem } from '@/components/group';
import { Chip } from '@/components/status-mark';
import { Body, Meta, SectionLabel } from '@/components/text';
import { INSET, LABEL_GAP, ROW_GAP, SPACE, useTheme } from '@/theme';

import { WeekJohnRow, type WeekContext } from './john-row';

/**
 * One person's week: a header with their 24pt avatar, their name ("You" for
 * you), "Swap ready" on yours while you hold a swap token, and on the right
 * how many are done and their points, with any time away on a line under
 * that; then their Johns as rows, with the finished ones folded under "Done
 * (n)", and how many of those were late, in hazard.
 */
export function PersonSection({
  person,
  context,
  points,
  away,
  swapReady = false,
}: {
  person: WeekPerson<BoardItem>;
  context: WeekContext;
  /** Their points this week, as the Table counts them. */
  points: number;
  /** "away 29 Oct – 1 Nov", from core's weekAwayNote: a line of its own under the counts. */
  away: string | null;
  swapReady?: boolean;
}) {
  const { colors } = useTheme();
  const mine = person.userId === context.userId;
  const name = context.nameOf(person.userId) ?? FOCUS_SHELL_COPY.formerHousemate;
  const fold = weekFold(person.folded);
  const counts = weekPersonMeta({ done: person.done, total: person.total, points });
  return (
    <View testID={`person-${person.userId}`}>
      {/*
        Section's header, laid out to keep every part whole: where the name,
        its tag and the counts don't fit on one line, the counts move under
        them rather than cutting the name or the dates short.
      */}
      <View style={styles.header}>
        <View style={styles.who}>
          <Avatar name={name} me={mine} size={24} />
          <SectionLabel numberOfLines={1} style={styles.name}>
            {weekWho(person.userId, context.userId, context.nameOf)}
          </SectionLabel>
          {swapReady ? <Chip label={WEEK_SUMMARY_COPY.swapReady} icon={RepeatIcon} testID="swap-ready" /> : null}
        </View>
        {counts || away ? (
          <View style={styles.meta}>
            {counts ? (
              <Meta numberOfLines={1} style={styles.end}>
                {counts}
              </Meta>
            ) : null}
            {away ? (
              <Meta numberOfLines={1} style={styles.end} testID="person-away">
                {away}
              </Meta>
            ) : null}
          </View>
        ) : null}
      </View>
      <Group>
        {person.rows.map((item) => (
          <WeekJohnRow key={item.id} item={item} context={context} />
        ))}
        {fold.count > 0 ? (
          <Fold
            label={FOCUS_SHELL_COPY.done(fold.count)}
            meta={fold.late ? <Text style={{ color: colors.hazard }}>{fold.late}</Text> : undefined}
            testID="done-fold"
          >
            {person.folded.map((item) => (
              <WeekJohnRow key={item.id} item={item} context={context} />
            ))}
          </Fold>
        ) : null}
        {person.total === 0 ? (
          <GroupItem>
            <Body>{WEEK_SUMMARY_COPY.nothing}</Body>
          </GroupItem>
        ) : null}
      </Group>
    </View>
  );
}

const styles = StyleSheet.create({
  // The counts wrap under the name only when the line can't hold both.
  header: {
    minHeight: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    columnGap: ROW_GAP,
    rowGap: SPACE.xs,
    paddingHorizontal: INSET,
    marginBottom: LABEL_GAP,
  },
  // Shrinks (cutting the name) only when it can't fit a line on its own.
  who: { minHeight: 24, flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  // Overpass's caps sit high in their line, so the name comes down a little.
  name: { flexShrink: 1, paddingTop: 2 },
  // Pushed to the right, on the name's line or the one under it; a 20pt line centred on the 24pt avatar.
  meta: { flexShrink: 1, marginLeft: 'auto', alignItems: 'flex-end', paddingTop: 2 },
  end: { textAlign: 'right' },
});
