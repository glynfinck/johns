import { formatMoney, HOUSE_PAGE_COPY, PAGE_TITLE } from '@app/core';

import { LeaveSection } from '@/components/house-page/leave-section';
import { MonthCard } from '@/components/house-page/month-card';
import { SetupSection } from '@/components/house-page/setup-section';
import { TableSection } from '@/components/house-page/table-section';
import { WallSection } from '@/components/house-page/wall-section';
import { YouSection } from '@/components/house-page/you-section';
import { PageTitle } from '@/components/page-title';
import { Reading, ReadFailed } from '@/components/read-state';
import { Screen } from '@/components/screen';
import { TitleBar } from '@/components/title-bar';
import { useAway } from '@/hooks/use-away';
import { useHouse } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { usePull, useReadOnFocus } from '@/hooks/use-refresh';
import { useStake } from '@/hooks/use-stake';
import { useTable } from '@/hooks/use-table';

/**
 * House, the third tab: the house's group page. The month's money and
 * settling up in the one card, then the Table; below them the lower
 * sections, each its own component in components/house-page: the Wall's
 * latest, the house's setup, you, and leaving. The pages it pushes keep the
 * tabs (house/_layout is a stack).
 */
export default function HouseScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <HouseFor houseId={house!.id} userId={session!.user.id} />;
}

function HouseFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { query, view } = useHouse(houseId, userId);
  const table = useTable(houseId, query.data);
  const stake = useStake(houseId, query.data);
  const away = useAway(houseId, query.data);
  // Who lives here, the rules and time away aren't sent over Realtime, so
  // read the house again each time House comes into view.
  useReadOnFocus(query.refetch);
  const { refreshing, pull } = usePull(houseId, () =>
    Promise.all([query.refetch(), table.refetch(), stake.refetch(), away.refetch()]),
  );

  const snapshot = view?.snapshot;
  const bar = (
    <TitleBar
      title={snapshot?.house.name ?? PAGE_TITLE.house}
      sub={
        snapshot
          ? HOUSE_PAGE_COPY.sub(snapshot.members.length, formatMoney(snapshot.rules.stakeMinor, snapshot.rules.currency))
          : undefined
      }
    />
  );

  return (
    <Screen bar={bar} refreshing={refreshing} onRefresh={pull} testID="house-screen">
      <PageTitle page={PAGE_TITLE.house} />
      {!view ? (
        query.isError ? (
          <ReadFailed onRetry={() => void query.refetch()} />
        ) : (
          <Reading />
        )
      ) : (
        <>
          <MonthCard houseId={houseId} userId={userId} view={view} stake={stake} />
          <TableSection userId={userId} view={view} table={table} stake={stake} away={away} />

          <WallSection houseId={houseId} userId={userId} view={view} />
          <SetupSection houseId={houseId} userId={userId} view={view} />
          <YouSection houseId={houseId} userId={userId} view={view} />
          <LeaveSection houseId={houseId} userId={userId} view={view} />
        </>
      )}
    </Screen>
  );
}
