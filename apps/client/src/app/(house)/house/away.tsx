import { AWAY_COPY, myTrips, PAGE_TITLE, SETUP_COPY } from '@app/core';

import type { AwayView } from '@/api/away';
import { HousePage } from '@/components/house/house-page';
import { AwayCalendar, AwayForm, MyTrips } from '@/components/house/time-away';
import { Section } from '@/components/section';
import { useAway } from '@/hooks/use-away';
import { useHouse, type HouseView } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { usePull, useReadOnFocus } from '@/hooks/use-refresh';

/**
 * Time away, pushed from House: your own trips (cancel one, or say you're
 * back), who else in the house is away when, and booking a trip.
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
      {() => <AwayPage houseId={houseId} userId={userId} view={view!} away={away.data!} />}
    </HousePage>
  );
}

function AwayPage({ houseId, userId, view, away }: { houseId: string; userId: string; view: HouseView; away: AwayView }) {
  const { snapshot } = view;
  const { periods, today } = away;
  const mine = myTrips(periods, userId, today);
  return (
    <>
      {mine.length > 0 ? (
        <Section label={AWAY_COPY.yours} testID="my-trips">
          <MyTrips houseId={houseId} periods={mine} today={today} />
        </Section>
      ) : null}
      <Section label={SETUP_COPY.whosAway} testID="away-panel">
        <AwayCalendar periods={periods} people={snapshot.members} me={userId} today={today} weekStarts={snapshot.rules.weekStarts} />
      </Section>
      <Section label={AWAY_COPY.book}>
        <AwayForm houseId={houseId} today={today} weekStarts={snapshot.rules.weekStarts} />
      </Section>
    </>
  );
}
