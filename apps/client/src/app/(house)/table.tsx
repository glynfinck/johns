import { monthLabel, PAGE_TITLE, TABLE_COPY } from '@app/core';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Alert } from '@/components/alert';
import { Card } from '@/components/card';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { FairShares, Standings, Streaks, type People } from '@/components/table-parts';
import { Body, Eyebrow, Heading } from '@/components/text';
import { useCatchUp, useHouse } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { useTable } from '@/hooks/use-table';
import { SPACE, useTheme, WIDE } from '@/theme';

/** The Table: effort points this week and this month, fair shares, streaks and perks, as the web's /table. */
export default function TableScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <TableFor houseId={house!.id} userId={session!.user.id} />;
}

function TableFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { colors } = useTheme();
  const wide = useWindowDimensions().width >= WIDE;
  const { query, view } = useHouse(houseId, userId);
  const table = useTable(houseId, query.data);
  const [refreshing, setRefreshing] = useState(false);
  const freshen = useCatchUp(houseId);

  async function pull() {
    setRefreshing(true);
    if (!(await freshen())) await Promise.all([query.refetch(), table.refetch()]);
    setRefreshing(false);
  }

  const people: People = {
    me: userId,
    nameOf: (id) => view?.snapshot.members.find((m) => m.userId === id)?.name ?? 'Housemate',
  };

  return (
    <Screen maxWidth={wide ? 1152 : 720} refreshing={refreshing} onRefresh={() => void pull()} testID="table-screen">
      <PageTitle page={PAGE_TITLE.table} />
      <View style={styles.stack}>
        <View>
          <Eyebrow>{TABLE_COPY.eyebrow}</Eyebrow>
          <Heading style={styles.title}>{TABLE_COPY.title}</Heading>
        </View>

        {query.isError || table.isError ? <Alert message="Couldn't read the Table. Check the connection." /> : null}

        {!view || !table.data ? (
          <ActivityIndicator color={colors.foreground} accessibilityLabel="Reading the Table" style={styles.loading} />
        ) : (
          <>
            <View style={[styles.pair, wide && styles.pairWide]}>
              <Card style={[styles.card, wide && styles.half]}>
                <Eyebrow>{TABLE_COPY.thisWeek}</Eyebrow>
                <Standings rows={view.board.table} people={people} />
              </Card>
              <Card style={[styles.card, wide && styles.half]}>
                <Eyebrow>{monthLabel(table.data.month)}</Eyebrow>
                <Standings rows={table.data.monthTable} people={people} />
              </Card>
            </View>

            <Card style={styles.card}>
              <Eyebrow>{TABLE_COPY.shares}</Eyebrow>
              <Body muted style={styles.body}>
                {TABLE_COPY.sharesBody}
              </Body>
              <FairShares balances={table.data.balances} people={people} awayMakeup={view.snapshot.house.awayMakeup} />
            </Card>

            <Card style={styles.card}>
              <Eyebrow>{TABLE_COPY.streaks}</Eyebrow>
              <Streaks members={view.snapshot.members} people={people} />
            </Card>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  title: { marginTop: SPACE.xs },
  loading: { marginTop: SPACE.xxl },
  pair: { gap: SPACE.lg },
  pairWide: { flexDirection: 'row', alignItems: 'flex-start' },
  half: { flex: 1 },
  card: { gap: SPACE.lg },
  body: { fontSize: 14, lineHeight: 20 },
});
