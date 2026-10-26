import {
  FOCUS_SHELL_COPY,
  formatMoney,
  HOUSE_COPY,
  MEMBERS_COPY,
  monthLabel,
  PAGE_TITLE,
  SHELL_COPY,
  STAKE_COPY,
  TABLE_COPY,
} from '@app/core';
import { CoinsIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Group, GroupItem } from '@/components/group';
import { LeaveSection } from '@/components/house-page/leave-section';
import { SetupSection } from '@/components/house-page/setup-section';
import { WallSection } from '@/components/house-page/wall-section';
import { YouSection } from '@/components/house-page/you-section';
import { InviteCard } from '@/components/invite-card';
import { PageTitle } from '@/components/page-title';
import { Reading, ReadFailed } from '@/components/read-state';
import { Row, RowIcon } from '@/components/row';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { FairShares, Standings, Streaks, type People } from '@/components/table-parts';
import { Body } from '@/components/text';
import { TitleBar } from '@/components/title-bar';
import { useHouse, type HouseView } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { usePull, useReadOnFocus } from '@/hooks/use-refresh';
import { useTable } from '@/hooks/use-table';
import { SECTION_GAP } from '@/theme';

/**
 * House, the third tab: the Stake, who lives here (each one a page of their
 * own), the invite and for now the old Table; then the lower sections, each
 * its own component in components/house-page: the Wall, the house's setup
 * pages, you, and leaving. The House tracks rebuild this page; the pages it
 * pushes keep the tabs (house/_layout is a stack).
 */
export default function HouseScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <HouseFor houseId={house!.id} userId={session!.user.id} />;
}

function HouseFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { query, view } = useHouse(houseId, userId);
  const table = useTable(houseId, query.data);
  // Who lives here and the rules aren't sent over Realtime, so read the
  // house again each time House comes into view.
  useReadOnFocus(query.refetch);
  const { refreshing, pull } = usePull(houseId, () => Promise.all([query.refetch(), table.refetch()]));

  const snapshot = view?.snapshot;
  const bar = (
    <TitleBar
      title={snapshot?.house.name ?? PAGE_TITLE.house}
      sub={snapshot ? SHELL_COPY.housemates(snapshot.members.length) : undefined}
    />
  );

  return (
    <Screen bar={bar} refreshing={refreshing} onRefresh={pull} testID="house-screen">
      <PageTitle page={PAGE_TITLE.house} />
      {!view || !snapshot ? (
        query.isError ? (
          <ReadFailed onRetry={() => void query.refetch()} />
        ) : (
          <Reading />
        )
      ) : (
        <>
          <Group>
            <Row
              leading={<RowIcon icon={CoinsIcon} />}
              title={STAKE_COPY.title}
              meta={STAKE_COPY.eyebrow(formatMoney(snapshot.rules.stakeMinor, snapshot.rules.currency))}
              href="/house/stake"
              chevron
              testID="to-stake"
            />
          </Group>

          <Section label={HOUSE_COPY.members}>
            {snapshot.members.map((m) => (
              <Row
                key={m.userId}
                leading={<Avatar name={m.name} me={m.userId === userId} />}
                title={m.userId === userId ? `${m.name} ${MEMBERS_COPY.you}` : m.name}
                meta={m.role === 'admin' ? MEMBERS_COPY.admin : MEMBERS_COPY.housemate}
                href={`/house/people/${m.userId}`}
                chevron
                testID="member"
              />
            ))}
          </Section>

          <InviteCard code={snapshot.house.joinCode} houseName={snapshot.house.name} />

          <TableForNow view={view} userId={userId} table={table} />

          <WallSection houseId={houseId} userId={userId} view={view} />
          <SetupSection houseId={houseId} userId={userId} view={view} />
          <YouSection houseId={houseId} userId={userId} view={view} />
          <LeaveSection houseId={houseId} userId={userId} view={view} />
        </>
      )}
    </Screen>
  );
}

/**
 * The old Table's content (the week and the month, fair shares, streaks),
 * parked at the foot of House until the House track rebuilds it as the
 * standings on a housemate's page.
 */
function TableForNow({ view, userId, table }: { view: HouseView; userId: string; table: ReturnType<typeof useTable> }) {
  const people: People = {
    me: userId,
    nameOf: (id) => view.snapshot.members.find((m) => m.userId === id)?.name ?? FOCUS_SHELL_COPY.formerHousemate,
  };
  return (
    <View testID="house-table" style={styles.table}>
      <Section label={TABLE_COPY.beside}>
        <GroupItem>
          <Standings rows={view.board.table} people={people} />
        </GroupItem>
      </Section>
      {!table.data ? (
        table.isError ? (
          <ReadFailed message="Couldn't read the Table. Check the connection." onRetry={() => void table.refetch()} />
        ) : (
          <Reading label="Reading the Table" />
        )
      ) : (
        <>
          <Section label={monthLabel(table.data.month)}>
            <GroupItem>
              <Standings rows={table.data.monthTable} people={people} />
            </GroupItem>
          </Section>
          <Section label={TABLE_COPY.shares}>
            <GroupItem>
              <Body muted>{TABLE_COPY.sharesBody}</Body>
              <FairShares balances={table.data.balances} people={people} awayMakeup={view.snapshot.house.awayMakeup} />
            </GroupItem>
          </Section>
          <Section label={TABLE_COPY.streaks}>
            <GroupItem>
              <Streaks members={view.snapshot.members} people={people} />
            </GroupItem>
          </Section>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { gap: SECTION_GAP },
});
