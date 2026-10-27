import { canRedeal, johnsComing, PAGE_TITLE } from '@app/core';

import type { JohnList as List } from '@/api/settings';
import { HousePage } from '@/components/house/house-page';
import { JohnList } from '@/components/house/john-list';
import { DealFoot } from '@/components/setup/deal-foot';
import { useHouse, type HouseView } from '@/hooks/use-house';
import { useJohnList } from '@/hooks/use-john-list';
import { useMembership } from '@/hooks/use-membership';
import { usePull, useReadOnFocus } from '@/hooks/use-refresh';

/**
 * The John list, pushed from House: every John by kind, how often and how
 * much. Tapping one opens it, to edit for an admin and to read for everyone
 * else. An admin adds Johns at the foot, and hands out the week under them
 * (or deals it again, while nothing in it is ticked).
 */
export default function JohnListScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <JohnListFor houseId={house!.id} userId={session!.user.id} />;
}

function JohnListFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { query, view } = useHouse(houseId, userId);
  const list = useJohnList(houseId);
  // Neither the list nor the rules come over Realtime: read them again on
  // the way back to this page. (The list's first read is its own, just now.)
  useReadOnFocus(query.refetch);
  useReadOnFocus(list.refetch, { skipFirst: true });
  const { refreshing, pull } = usePull(houseId, () => Promise.all([query.refetch(), list.refetch()]));
  const retry = () => void Promise.all([query.refetch(), list.refetch()]);

  // What was read goes down whole, and the page reads its parts once it's
  // there: React's compiler reads what a callback uses before calling it.
  return (
    <HousePage
      title={PAGE_TITLE.johnList}
      testID="johns-screen"
      ready={view !== null && list.data !== undefined}
      failed={query.isError || list.isError}
      onRetry={retry}
      refreshing={refreshing}
      onRefresh={pull}
    >
      {() => <JohnListPage houseId={houseId} userId={userId} view={view!} list={list.data!} />}
    </HousePage>
  );
}

function JohnListPage({ houseId, userId, view, list }: { houseId: string; userId: string; view: HouseView; list: List }) {
  const isAdmin = view.me?.role === 'admin';
  return (
    <>
      <JohnList
        houseId={houseId}
        rules={view.snapshot.rules}
        johns={list.johns}
        groups={list.groups}
        editable={isAdmin}
        whoAdds={johnsComing(view.snapshot.members, userId)}
      />
      {isAdmin && list.johns.length > 0 ? (
        <DealFoot houseId={houseId} started={view.snapshot.house.everDealt} canRedeal={canRedeal(view.board)} />
      ) : null}
    </>
  );
}
