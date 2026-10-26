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
import { Text } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Fold } from '@/components/fold';
import { GroupItem } from '@/components/group';
import { Section } from '@/components/section';
import { Chip } from '@/components/status-mark';
import { Body } from '@/components/text';
import { useTheme } from '@/theme';

import { WeekJohnRow, type WeekContext } from './john-row';

/**
 * One person's week, as a Section: a header with their 24pt avatar, their
 * name ("You" for you), "Swap ready" on yours while you hold a swap token,
 * and on the right how many are done and their points, with any time away on
 * a line under that; then their Johns as rows, with the finished ones folded
 * under "Done (n)", and how many of those were late, in hazard.
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
    <Section
      label={weekWho(person.userId, context.userId, context.nameOf)}
      leading={<Avatar name={name} me={mine} size={24} />}
      tag={swapReady ? <Chip label={WEEK_SUMMARY_COPY.swapReady} icon={RepeatIcon} testID="swap-ready" /> : undefined}
      // Where the name, its tag and these don't fit on one line, these move under them.
      right={[counts, away].filter((line): line is string => Boolean(line))}
      testID={`person-${person.userId}`}
    >
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
    </Section>
  );
}
