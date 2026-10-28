import { PAGE_TITLE } from '@app/core';

import { DescribeHouse } from '@/components/house/describe-house';
import { HousePage } from '@/components/house/house-page';
import { useHouse } from '@/hooks/use-house';
import { useJohnList } from '@/hooks/use-john-list';
import { useMembership } from '@/hooks/use-membership';

/**
 * Describe your house, pushed from Today's setup card and from an empty
 * John list: Claude drafts the Johns from a sentence or two (or a starter
 * list does), and an admin keeps what they want of the draft.
 */
export default function DescribeScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <DescribeFor houseId={house!.id} userId={session!.user.id} />;
}

function DescribeFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { query, view } = useHouse(houseId, userId);
  const list = useJohnList(houseId);
  const retry = () => void Promise.all([query.refetch(), list.refetch()]);
  return (
    <HousePage
      title={PAGE_TITLE.describe}
      testID="describe-screen"
      ready={view !== null && list.data !== undefined}
      failed={query.isError || list.isError}
      onRetry={retry}
    >
      {() => (
        <DescribeHouse
          houseId={houseId}
          rules={view!.snapshot.rules}
          groups={list.data!.groups}
          people={view!.snapshot.members}
          me={userId}
        />
      )}
    </HousePage>
  );
}
