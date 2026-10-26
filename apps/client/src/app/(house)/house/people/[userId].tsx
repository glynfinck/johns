import { FOCUS_SHELL_COPY, PAGE_TITLE } from '@app/core';
import { useLocalSearchParams } from 'expo-router';

import { Group, GroupItem } from '@/components/group';
import { HousePage } from '@/components/house/house-page';
import { MemberRow } from '@/components/house/members-list';
import { Body } from '@/components/text';
import { useHouse } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { usePull, useReadOnFocus } from '@/hooks/use-refresh';

/**
 * A housemate's page, pushed from House's list of who lives here: for now
 * their name and their row (Make admin and Remove, for an admin). The House
 * track builds it out: their week, their standing, their stake.
 */
export default function PersonScreen() {
  const { session, house } = useMembership();
  const { userId: personId } = useLocalSearchParams<{ userId: string }>();
  // The layout's guard only shows the house's screens with a house and a session.
  return <PersonFor houseId={house!.id} userId={session!.user.id} personId={personId} />;
}

function PersonFor({ houseId, userId, personId }: { houseId: string; userId: string; personId: string }) {
  const { query, view } = useHouse(houseId, userId);
  // Who lives here doesn't come over Realtime: read it again on the way back here.
  useReadOnFocus(query.refetch);
  const { refreshing, pull } = usePull(houseId, query.refetch);
  const person = view?.snapshot.members.find((m) => m.userId === personId) ?? null;

  return (
    <HousePage
      title={person?.name ?? PAGE_TITLE.house}
      testID="person-screen"
      ready={view !== null}
      failed={query.isError}
      onRetry={() => void query.refetch()}
      refreshing={refreshing}
      onRefresh={pull}
    >
      {() => (
        <Group>
          <GroupItem>
            {person ? (
              <MemberRow houseId={houseId} member={person} me={userId} isAdmin={view!.me?.role === 'admin'} />
            ) : (
              <Body muted>{FOCUS_SHELL_COPY.gone}</Body>
            )}
          </GroupItem>
        </Group>
      )}
    </HousePage>
  );
}
