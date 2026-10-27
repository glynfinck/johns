import { dayLabel, NEXT_UP_COPY, onCallItems, PAGE_TITLE, todayPage, type StakeView } from '@app/core';

import type { AwayView } from '@/api/away';
import type { JohnList } from '@/api/settings';
import { PageTitle } from '@/components/page-title';
import { Reading, ReadFailed } from '@/components/read-state';
import { Screen } from '@/components/screen';
import { TitleBar } from '@/components/title-bar';
import { NeedsYou } from '@/components/today/needs-you';
import { NextUp } from '@/components/today/next-up';
import { OnCall } from '@/components/today/on-call';
import { PageLine, PageLines } from '@/components/today/page-line';
import { RestOfWeek } from '@/components/today/rest-of-week';
import { SetupCard } from '@/components/today/setup-card';
import { useAway } from '@/hooks/use-away';
import { useHouse, type HouseView } from '@/hooks/use-house';
import { useJohnList } from '@/hooks/use-john-list';
import { useMembership } from '@/hooks/use-membership';
import { usePull, useReadOnFocus } from '@/hooks/use-refresh';
import { useStake } from '@/hooks/use-stake';

/**
 * Today, for doing: your next John in the one card (or what takes its
 * place), the disputes that need your vote, the on-call Johns anyone can
 * flag, the rest of your week, and one
 * line on where you stand (with your time away, when a trip is coming).
 * Fits one phone screen.
 */
export default function Today() {
  const { session, house } = useMembership();
  // The layout's guard only shows Today with a house and a session.
  return <TodayFor houseId={house!.id} userId={session!.user.id} />;
}

function TodayFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { query, view } = useHouse(houseId, userId);
  const away = useAway(houseId, query.data);
  const stake = useStake(houseId, query.data);
  // The setup checklist counts the list.
  const list = useJohnList(houseId);
  // Time away isn't followed live: read it again whenever Today comes back into view.
  useReadOnFocus(away.refetch, { skipFirst: true });
  const { refreshing, pull } = usePull(houseId, () =>
    Promise.all([query.refetch(), away.refetch(), stake.refetch(), list.refetch()]),
  );

  return (
    <Screen
      bar={
        <TitleBar
          title={PAGE_TITLE.today}
          right={view ? dayLabel(view.now, view.snapshot.rules.timezone) : undefined}
        />
      }
      refreshing={refreshing}
      onRefresh={pull}
      testID="today-screen"
    >
      <PageTitle page={PAGE_TITLE.today} />
      {view ? (
        <TodayView view={view} away={away.data ?? null} stake={stake.data ?? null} list={list.data ?? null} />
      ) : query.isError ? (
        <ReadFailed onRetry={() => void query.refetch()} />
      ) : (
        <Reading />
      )}
    </Screen>
  );
}

function TodayView({
  view,
  away,
  stake,
  list,
}: {
  view: HouseView;
  away: AwayView | null;
  stake: StakeView | null;
  list: JohnList | null;
}) {
  const { snapshot, board, today, me, now } = view;
  const { house, rules, members } = snapshot;
  const userId = me?.userId ?? '';
  const page = todayPage({ board, mine: today.mine, userId, me, members, rules, away, stake });
  const nameOf = (id: string) => members.find((m) => m.userId === id)?.name ?? null;

  return (
    <>
      {page.state.kind === 'setup' ? (
        <SetupCard
          houseId={house.id}
          houseName={house.name}
          joinCode={house.joinCode}
          johns={list?.johns ?? null}
          memberCount={members.length}
        />
      ) : (
        <NextUp
          houseId={house.id}
          state={page.state}
          rules={rules}
          now={now}
          cant={page.cant}
          room={page.room}
          awayMakeup={house.awayMakeup}
        />
      )}
      <NeedsYou items={today.toVote} members={members} now={now} />
      <OnCall
        houseId={house.id}
        items={onCallItems(snapshot.onCall, board)}
        members={members}
        userId={userId}
        rules={rules}
        now={now}
      />
      <RestOfWeek
        going={page.going}
        finished={page.finished}
        context={{ houseId: house.id, userId, zone: rules.timezone, rules, now, nameOf }}
      />
      {page.standing || page.away ? (
        // The page's quiet lines sit together, under the week.
        <PageLines>
          {page.standing ? <PageLine text={page.standing} href="/house" testID="standing-line" /> : null}
          {page.away ? (
            <PageLine
              text={page.away}
              href="/house/away"
              accessibilityLabel={`${page.away}. ${NEXT_UP_COPY.changeDates}`}
              testID="away-line"
            />
          ) : null}
        </PageLines>
      ) : null}
    </>
  );
}
