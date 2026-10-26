import { DEAL_COPY, PAGE_TITLE } from '@app/core';

import { Group, GroupItem } from '@/components/group';
import { DealButton } from '@/components/house/deal-button';
import { HousePage } from '@/components/house/house-page';
import { JohnList } from '@/components/house/john-list';
import { Body } from '@/components/text';
import { useHouse } from '@/hooks/use-house';
import { useJohnList } from '@/hooks/use-john-list';
import { useMembership } from '@/hooks/use-membership';
import { usePull, useReadOnFocus } from '@/hooks/use-refresh';

/**
 * The John list, pushed from House: every John, how often and how much, and
 * for an admin, adding and editing them and handing out the week. For now
 * the old House panel; the Setup track rebuilds it.
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
      {() => {
        const { snapshot } = view!;
        const isAdmin = view!.me?.role === 'admin';
        return (
          <Group testID="john-panel">
            <GroupItem>
              <JohnList
                houseId={houseId}
                rules={snapshot.rules}
                johns={list.data!.johns}
                groups={list.data!.groups}
                editable={isAdmin}
              />
            </GroupItem>
            {isAdmin && list.data!.johns.length > 0 ? (
              <GroupItem>
                <Body muted>{snapshot.house.everDealt ? DEAL_COPY.againBody : DEAL_COPY.firstBody}</Body>
                <DealButton houseId={houseId} started={snapshot.house.everDealt} />
              </GroupItem>
            ) : null}
          </Group>
        );
      }}
    </HousePage>
  );
}
