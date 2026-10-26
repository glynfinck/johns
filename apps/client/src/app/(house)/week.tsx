import { awayThisWeek, isOpen, PAGE_TITLE, TODAY_COPY, weekRange } from '@app/core';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { NotDealt } from '@/components/not-dealt';
import { PageTitle } from '@/components/page-title';
import { Reading, ReadFailed } from '@/components/read-state';
import { Screen } from '@/components/screen';
import { SwapSheet } from '@/components/swap-sheet';
import { TableBeside } from '@/components/table-parts';
import { Eyebrow } from '@/components/text';
import { TitleBar } from '@/components/title-bar';
import { DealButton } from '@/components/house/deal-button';
import { AwayThisWeek, DisputeList, PersonSection, Stats, WeekTable, type BoardContext } from '@/components/week-board';
import { useAway } from '@/hooks/use-away';
import { useHouse, type HouseView } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { usePull } from '@/hooks/use-refresh';
import { CONTENT_MAX, SPACE, WIDE } from '@/theme';

/**
 * For now, room on a laptop for the old board's table and its side column.
 * Focus keeps every tab to CONTENT_MAX, and the Week track's table does too.
 */
const WEEK_WIDE = 1280;

/**
 * Week: the whole house's week. For now the old board under Focus's title
 * bar; the Week track rebuilds it.
 */
export default function Week() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <WeekFor houseId={house!.id} userId={session!.user.id} />;
}

function WeekFor({ houseId, userId }: { houseId: string; userId: string }) {
  const wide = useWindowDimensions().width >= WIDE;
  const { query, view } = useHouse(houseId, userId);
  const { refreshing, pull } = usePull(houseId, query.refetch);

  return (
    <Screen
      bar={<TitleBar title={PAGE_TITLE.week} />}
      maxWidth={wide ? WEEK_WIDE : CONTENT_MAX}
      refreshing={refreshing}
      onRefresh={pull}
      testID="week-screen"
    >
      <PageTitle page={PAGE_TITLE.week} />
      {view ? (
        <Board view={view} wide={wide} />
      ) : query.isError ? (
        <ReadFailed onRetry={() => void query.refetch()} />
      ) : (
        <Reading />
      )}
    </Screen>
  );
}

function Board({ view, wide }: { view: HouseView; wide: boolean }) {
  const { snapshot, board, me, now } = view;
  const { house, members, rules } = snapshot;
  const away = useAway(house.id, snapshot).data;
  const userId = me?.userId ?? '';
  const nameOf = (id: string) => members.find((m) => m.userId === id)?.name ?? 'Housemate';
  const context: BoardContext = { houseId: house.id, userId, zone: rules.timezone, now, nameOf };
  const admin = members.find((m) => m.role === 'admin');

  if (!board.week) {
    return (
      <View style={styles.stack}>
        <Eyebrow>{TODAY_COPY.thisWeek}</Eyebrow>
        <NotDealt houseId={house.id} notStarted={board.notStarted} isAdmin={me?.role === 'admin'} adminName={admin?.name ?? 'An admin'} />
      </View>
    );
  }

  const items = board.items;
  const myOpen = items.filter((i) => i.userId === userId && isOpen(i.status));
  const theirOpen = items.filter((i) => i.userId !== userId && isOpen(i.status));
  const nothingTicked = items.every((i) => !i.doneAt && !i.outcome);
  const awayLabel = (id: string) => (away ? awayThisWeek(away.periods, id, board.week!.startsOn) : null);
  // Everyone with a John this week, or away some of it, in the order they joined.
  const people = members.filter((m) => items.some((i) => i.userId === m.userId) || awayLabel(m.userId));
  const awayNow = members.map((m) => ({ ...m, label: awayLabel(m.userId) })).filter((m) => m.label !== null);

  return (
    <View style={styles.stack}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Eyebrow>{TODAY_COPY.thisWeekRange(weekRange(board.week.startsAt, board.week.endsAt, rules.timezone))}</Eyebrow>
        </View>
        {me && me.swapTokens > 0 ? (
          <SwapSheet
            houseId={house.id}
            mine={myOpen.map((i) => ({ id: i.id, name: i.name }))}
            theirs={theirOpen.map((i) => ({ id: i.id, name: i.name, owner: nameOf(i.userId) }))}
          />
        ) : null}
        {/* As on the web: a week nobody has ticked in can be dealt again. */}
        {me?.role === 'admin' && nothingTicked ? <DealButton houseId={house.id} started /> : null}
      </View>

      <Stats items={items} />

      {wide ? (
        <View style={styles.columns}>
          <View style={styles.main}>
            <WeekTable context={context} items={items} />
          </View>
          <View style={styles.aside}>
            <DisputeList context={context} items={items} />
            {awayNow.length > 0 ? <AwayThisWeek people={awayNow} me={userId} /> : null}
            <TableBeside rows={board.table} people={{ me: userId, nameOf }} />
          </View>
        </View>
      ) : (
        <>
          {people.map((p) => (
            <PersonSection
              key={p.userId}
              context={context}
              userId={p.userId}
              items={items.filter((i) => i.userId === p.userId)}
              immunityTokens={me?.immunityTokens ?? 0}
              away={awayLabel(p.userId)}
            />
          ))}
          {/* On a phone each card carries its own votes, so only the Table follows. */}
          <TableBeside rows={board.table} people={{ me: userId, nameOf }} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.xl },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: SPACE.md },
  headerText: { flexShrink: 1 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.xl },
  main: { flex: 1, minWidth: 0 },
  aside: { width: 320, gap: SPACE.lg },
});
