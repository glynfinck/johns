import { isOpen, weekRange, WEEK_COPY, TODAY_COPY } from '@app/core';
import { RefreshCwIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { NotDealt } from '@/components/not-dealt';
import { Screen } from '@/components/screen';
import { SwapSheet } from '@/components/swap-sheet';
import { TableBeside } from '@/components/table-parts';
import { Eyebrow, Heading } from '@/components/text';
import { DisputeList, PersonSection, Stats, WeekTable, type BoardContext } from '@/components/week-board';
import { useCatchUp, useHouse, type HouseView } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { SPACE, useTheme, WIDE } from '@/theme';

/** The board: the whole house's week, as the web's /week. */
export default function Week() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <WeekFor houseId={house!.id} userId={session!.user.id} />;
}

function WeekFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { colors } = useTheme();
  const wide = useWindowDimensions().width >= WIDE;
  const { query, view } = useHouse(houseId, userId);
  const [refreshing, setRefreshing] = useState(false);
  const freshen = useCatchUp(houseId);

  async function pull() {
    setRefreshing(true);
    if (!(await freshen())) await query.refetch();
    setRefreshing(false);
  }

  return (
    <Screen maxWidth={wide ? 1280 : 720} refreshing={refreshing} onRefresh={() => void pull()}>
      {!view ? (
        query.isError ? (
          <View style={styles.stack}>
            <Alert message="Couldn't read the house. Check the connection." />
            <View style={styles.start}>
              <Button variant="outline" icon={RefreshCwIcon} label="Try again" onPress={() => void query.refetch()} />
            </View>
          </View>
        ) : (
          <ActivityIndicator color={colors.foreground} accessibilityLabel="Reading the house" style={styles.loading} />
        )
      ) : (
        <Board view={view} wide={wide} />
      )}
    </Screen>
  );
}

function Board({ view, wide }: { view: HouseView; wide: boolean }) {
  const { snapshot, board, me, now } = view;
  const { house, members, rules } = snapshot;
  const userId = me?.userId ?? '';
  const nameOf = (id: string) => members.find((m) => m.userId === id)?.name ?? 'Housemate';
  const context: BoardContext = { houseId: house.id, userId, zone: rules.timezone, now, nameOf };
  const admin = members.find((m) => m.role === 'admin');

  if (!board.week) {
    return (
      <View style={styles.stack}>
        <View>
          <Eyebrow>{TODAY_COPY.thisWeek}</Eyebrow>
          <Heading style={styles.title}>{WEEK_COPY.title}</Heading>
        </View>
        <NotDealt notStarted={board.notStarted} isAdmin={me?.role === 'admin'} adminName={admin?.name ?? 'An admin'} />
      </View>
    );
  }

  const items = board.items;
  const myOpen = items.filter((i) => i.userId === userId && isOpen(i.status));
  const theirOpen = items.filter((i) => i.userId !== userId && isOpen(i.status));
  // Everyone with a John this week, in the order they joined.
  const people = members.filter((m) => items.some((i) => i.userId === m.userId));

  return (
    <View style={styles.stack}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Eyebrow>{TODAY_COPY.thisWeekRange(weekRange(board.week.startsAt, board.week.endsAt, rules.timezone))}</Eyebrow>
          <Heading style={styles.title}>{WEEK_COPY.title}</Heading>
        </View>
        {me && me.swapTokens > 0 ? (
          <SwapSheet
            houseId={house.id}
            mine={myOpen.map((i) => ({ id: i.id, name: i.name }))}
            theirs={theirOpen.map((i) => ({ id: i.id, name: i.name, owner: nameOf(i.userId) }))}
          />
        ) : null}
      </View>

      <Stats items={items} />

      {wide ? (
        <View style={styles.columns}>
          <View style={styles.main}>
            <WeekTable context={context} items={items} />
          </View>
          <View style={styles.aside}>
            <DisputeList context={context} items={items} />
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
  start: { alignItems: 'flex-start' },
  loading: { marginTop: SPACE.xxl },
  title: { marginTop: SPACE.xs },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: SPACE.md },
  headerText: { flexShrink: 1 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.xl },
  main: { flex: 1, minWidth: 0 },
  aside: { width: 320, gap: SPACE.lg },
});
