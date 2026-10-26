import { PAGE_TITLE } from '@app/core';

import type { JohnList } from '@/api/settings';
import { GroupsList } from '@/components/house/groups-list';
import { HousePage } from '@/components/house/house-page';
import { useHouse, type HouseView } from '@/hooks/use-house';
import { useJohnList } from '@/hooks/use-john-list';
import { useMembership } from '@/hooks/use-membership';
import { usePull, useReadOnFocus } from '@/hooks/use-refresh';

/**
 * Groups, pushed from House: the parts of the house only some of you share,
 * each with who's in it. Admins make and change them.
 */
export default function GroupsScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <GroupsFor houseId={house!.id} userId={session!.user.id} />;
}

function GroupsFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { query, view } = useHouse(houseId, userId);
  const list = useJohnList(houseId);
  // Groups come with the John list, which doesn't come over Realtime.
  useReadOnFocus(list.refetch, { skipFirst: true });
  const { refreshing, pull } = usePull(houseId, () => Promise.all([query.refetch(), list.refetch()]));

  return (
    <HousePage
      title={PAGE_TITLE.groups}
      testID="groups-screen"
      ready={view !== null && list.data !== undefined}
      failed={query.isError || list.isError}
      onRetry={() => void Promise.all([query.refetch(), list.refetch()])}
      refreshing={refreshing}
      onRefresh={pull}
    >
      {() => <GroupsPage houseId={houseId} userId={userId} view={view!} list={list.data!} />}
    </HousePage>
  );
}

function GroupsPage({ houseId, userId, view, list }: { houseId: string; userId: string; view: HouseView; list: JohnList }) {
  return (
    <GroupsList
      houseId={houseId}
      groups={list.groups}
      people={view.snapshot.members}
      me={userId}
      editable={view.me?.role === 'admin'}
    />
  );
}
