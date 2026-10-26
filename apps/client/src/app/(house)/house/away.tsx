import { AWAY_COPY, PAGE_TITLE } from '@app/core';

import { Group, GroupItem } from '@/components/group';
import { HousePage } from '@/components/house/house-page';
import { AwayCalendar, AwayForm, MyTrips } from '@/components/house/time-away';
import { Section } from '@/components/section';
import { Body } from '@/components/text';
import { useAway } from '@/hooks/use-away';
import { useHouse } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { usePull, useReadOnFocus } from '@/hooks/use-refresh';

/**
 * Time away, pushed from House: who's away when, your own trips, and
 * booking one. For now the old House panel; the Setup track rebuilds it.
 */
export default function AwayScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <AwayFor houseId={house!.id} userId={session!.user.id} />;
}

function AwayFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { query, view } = useHouse(houseId, userId);
  const away = useAway(houseId, query.data);
  // Time away doesn't come over Realtime: read it again on the way back here.
  useReadOnFocus(away.refetch, { skipFirst: true });
  const { refreshing, pull } = usePull(houseId, () => Promise.all([query.refetch(), away.refetch()]));

  return (
    <HousePage
      title={PAGE_TITLE.away}
      testID="away-screen"
      ready={view !== null && away.data !== undefined}
      failed={query.isError || away.isError}
      onRetry={() => void Promise.all([query.refetch(), away.refetch()])}
      refreshing={refreshing}
      onRefresh={pull}
    >
      {() => {
        const { snapshot } = view!;
        const { periods, today } = away.data!;
        return (
          <>
            <Group testID="away-panel">
              <GroupItem>
                <AwayCalendar
                  periods={periods}
                  people={snapshot.members}
                  me={userId}
                  today={today}
                  weekStarts={snapshot.rules.weekStarts}
                />
              </GroupItem>
            </Group>
            <Section label={AWAY_COPY.yours}>
              <GroupItem>
                <MyTrips
                  houseId={houseId}
                  periods={periods.filter((p) => p.userId === userId && p.endsOn >= today)}
                  today={today}
                />
                <Body muted>{AWAY_COPY.howItWorks}</Body>
                <AwayForm houseId={houseId} today={today} weekStarts={snapshot.rules.weekStarts} />
              </GroupItem>
            </Section>
          </>
        );
      }}
    </HousePage>
  );
}
