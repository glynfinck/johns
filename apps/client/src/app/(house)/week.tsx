import {
  FOCUS_SHELL_COPY,
  firstName,
  liveWeekFilter,
  PAGE_TITLE,
  toggleWeekFilter,
  WEEK_SUMMARY_COPY,
  weekAwayLine,
  weekAwayNote,
  weekFairness,
  weekList,
  weekPeople,
  weekRangeLine,
  weekSummary,
  weekUnticked,
  type WeekPart,
} from '@app/core';
import { RepeatIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { PageTitle } from '@/components/page-title';
import { Reading, ReadFailed } from '@/components/read-state';
import { Screen } from '@/components/screen';
import { Chip } from '@/components/status-mark';
import { MoreButton, TitleBar } from '@/components/title-bar';
import { FairnessFooter } from '@/components/week/fair-shares';
import type { WeekContext } from '@/components/week/john-row';
import { PersonSection } from '@/components/week/person-section';
import { WeekSummaryBar } from '@/components/week/summary';
import { WeekEmpty } from '@/components/week/week-empty';
import { WeekMenu } from '@/components/week/week-menu';
import { WeekTable } from '@/components/week/week-table';
import { useAway } from '@/hooks/use-away';
import { useHouse, type HouseView } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { usePull, useReadOnFocus } from '@/hooks/use-refresh';
import { useTable } from '@/hooks/use-table';
import { WIDE } from '@/theme';

/**
 * Week: how the whole house's week is going. The title bar's "•••" holds
 * time away and, for admins, the John list and re-dealing. Then the summary,
 * whose legend filters the list; one group per person, you first, finished
 * Johns folded (from WIDE on the web, one table row per John instead, with
 * who's away and your swap under the summary); and the deal's fairness in a
 * sentence, which opens the fair shares. Tapping any John opens its sheet.
 */
export default function Week() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <WeekFor houseId={house!.id} userId={session!.user.id} />;
}

function WeekFor({ houseId, userId }: { houseId: string; userId: string }) {
  const wide = useWindowDimensions().width >= WIDE;
  const { query, view } = useHouse(houseId, userId);
  // Time away isn't on Realtime: read it again on coming back to Week. A pull reads it and the fair shares too.
  const away = useAway(houseId, view?.snapshot);
  const shares = useTable(houseId, view?.snapshot);
  useReadOnFocus(away.refetch, { skipFirst: true });
  const { refreshing, pull } = usePull(houseId, () =>
    Promise.all([query.refetch(), ...(view ? [away.refetch(), shares.refetch()] : [])]),
  );
  const [menu, setMenu] = useState(false);
  const board = view?.board;

  return (
    <Screen
      bar={
        <>
          <TitleBar title={PAGE_TITLE.week} right={<MoreButton onPress={() => setMenu(true)} />} />
          <WeekMenu
            visible={menu}
            onClose={() => setMenu(false)}
            houseId={houseId}
            admin={view?.me?.role === 'admin'}
            canRedeal={board?.week != null && weekUnticked(board.items)}
          />
        </>
      }
      refreshing={refreshing}
      onRefresh={pull}
      testID="week-screen"
    >
      <PageTitle page={PAGE_TITLE.week} />
      {view ? (
        <Board view={view} wide={wide} away={away.data} shares={shares.data} />
      ) : query.isError ? (
        <ReadFailed onRetry={() => void query.refetch()} />
      ) : (
        <Reading />
      )}
    </Screen>
  );
}

function Board({
  view,
  wide,
  away,
  shares,
}: {
  view: HouseView;
  wide: boolean;
  away: ReturnType<typeof useAway>['data'];
  shares: ReturnType<typeof useTable>['data'];
}) {
  const { snapshot, board, me, now } = view;
  const { house, members, rules } = snapshot;
  const [filter, setFilter] = useState<WeekPart | null>(null);
  const userId = me?.userId ?? '';
  const nameOf = (id: string) => members.find((m) => m.userId === id)?.name ?? null;
  const context: WeekContext = { houseId: house.id, userId, zone: rules.timezone, now, nameOf };

  if (!board.week || board.items.length === 0) {
    const admin = members.find((m) => m.role === 'admin');
    return (
      <WeekEmpty
        houseId={house.id}
        notStarted={board.notStarted}
        isAdmin={me?.role === 'admin'}
        adminName={admin ? firstName(admin.name) : FOCUS_SHELL_COPY.formerHousemate}
      />
    );
  }

  const week = board.week;
  const summary = weekSummary(board.items);
  const shown = liveWeekFilter(summary, filter);
  // A filter whose part has emptied lets go for good, so the part filling up again later doesn't hide the rest.
  if (filter !== null && shown === null) setFilter(null);
  const memberIds = members.map((m) => m.userId);
  const fairness = shares ? weekFairness(shares.balances, board.items.map((i) => i.points), userId, nameOf) : null;
  const pointsOf = (id: string) => board.table.find((r) => r.userId === id)?.points ?? 0;
  const awayOf = (id: string) => (away ? weekAwayNote(away.periods, id, week.startsOn, away.today) : null);
  const swapReady = (me?.swapTokens ?? 0) > 0;

  return (
    <>
      <WeekSummaryBar
        range={weekRangeLine(week.startsAt, week.endsAt, now, rules.timezone)}
        summary={summary}
        filter={shown}
        onFilter={(part) => setFilter(toggleWeekFilter(shown, part))}
        // The table has no person headers, so what they'd say about time away and your swap goes here.
        tag={wide && swapReady ? <Chip label={WEEK_SUMMARY_COPY.swapReady} icon={RepeatIcon} testID="swap-ready" /> : undefined}
        note={
          wide
            ? weekAwayLine(
                weekPeople(board.items, memberIds, userId).map((p) => ({ userId: p.userId, away: awayOf(p.userId) })),
                userId,
                nameOf,
              )
            : null
        }
      />
      {wide ? (
        <WeekTable {...weekList(board.items, shown)} context={context} />
      ) : (
        weekPeople(board.items, memberIds, userId, shown).map((person) => (
          <PersonSection
            key={person.userId}
            person={person}
            context={context}
            points={pointsOf(person.userId)}
            away={awayOf(person.userId)}
            swapReady={person.userId === userId && swapReady}
          />
        ))
      )}
      {fairness && shares ? (
        <FairnessFooter
          sentence={fairness}
          balances={shares.balances}
          memberIds={memberIds}
          viewerId={userId}
          nameOf={nameOf}
          awayMakeup={house.awayMakeup}
        />
      ) : null}
    </>
  );
}
