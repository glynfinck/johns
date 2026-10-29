import { formatMoney, HOUSE_PAGE_COPY, PAGE_TITLE, PASS_COPY, passUnlocked } from '@app/core';

import { LeaveSection } from '@/components/house-page/leave-section';
import { MonthCard } from '@/components/house-page/month-card';
import { PassLocked, PassSection } from '@/components/house-page/pass-section';
import { SetupSection } from '@/components/house-page/setup-section';
import { TableSection } from '@/components/house-page/table-section';
import { WallSection } from '@/components/house-page/wall-section';
import { YouSection } from '@/components/house-page/you-section';
import { PageTitle } from '@/components/page-title';
import { Reading, ReadFailed } from '@/components/read-state';
import { Screen } from '@/components/screen';
import { TitleBar, TopLine } from '@/components/title-bar';
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
 * latest, the house's setup, the House Pass, you, and leaving. Without the
 * Pass (once it's enforced) the month card and the Table give way to a row
 * to the Pass page. The pages it pushes keep the tabs (house/_layout is a
 * stack).
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
  const bar = <TitleBar title={snapshot?.house.name ?? PAGE_TITLE.house} ask={view?.me?.role === 'admin'} />;

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
          <TopLine>
            {HOUSE_PAGE_COPY.sub(
              view.snapshot.members.length,
              formatMoney(view.snapshot.rules.stakeMinor, view.snapshot.rules.currency),
            )}
          </TopLine>
          {passUnlocked(view.snapshot.house.pass, view.now) ? (
            <>
              <MonthCard houseId={houseId} userId={userId} view={view} stake={stake} />
              <TableSection userId={userId} view={view} table={table} stake={stake} away={away} />
            </>
          ) : (
            <>
              <PassLocked label={PASS_COPY.stake} feature={PASS_COPY.stake} testID="stake-locked" />
              <PassLocked label={PASS_COPY.table} feature={PASS_COPY.table} testID="table-locked" />
            </>
          )}

          <WallSection houseId={houseId} userId={userId} view={view} />
          <SetupSection houseId={houseId} userId={userId} view={view} />
          <PassSection view={view} />
          <YouSection houseId={houseId} userId={userId} view={view} />
          <LeaveSection houseId={houseId} userId={userId} view={view} />
        </>
      )}
    </Screen>
  );
}
