import { PAGE_TITLE } from '@app/core';
import { useState } from 'react';

import { Group, GroupItem } from '@/components/group';
import { HousePage } from '@/components/house/house-page';
import { RulesForm } from '@/components/house/rules-form';
import { useHouse } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { usePull, useReadOnFocus } from '@/hooks/use-refresh';

/**
 * The house rules, pushed from House: the name, the week, the money and the
 * dispute window. Admins change them; everyone reads them. For now the old
 * House panel; the Setup track rebuilds it.
 */
export default function RulesScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <RulesFor houseId={house!.id} userId={session!.user.id} />;
}

function RulesFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { query, view } = useHouse(houseId, userId);
  const [saved, setSaved] = useState(false);
  // The rules don't come over Realtime: read them again on the way back here.
  useReadOnFocus(query.refetch);
  const { refreshing, pull } = usePull(houseId, query.refetch);

  return (
    <HousePage
      title={PAGE_TITLE.rules}
      testID="rules-screen"
      ready={view !== null}
      failed={query.isError}
      onRetry={() => void query.refetch()}
      refreshing={refreshing}
      onRefresh={pull}
    >
      {() => {
        const { snapshot } = view!;
        return (
          <Group testID="rules-panel">
            <GroupItem>
              <RulesForm
                // A fresh form whenever the house's rules change underneath it.
                key={JSON.stringify([snapshot.house.name, snapshot.rules, snapshot.house.awayMakeup])}
                houseId={houseId}
                values={{ name: snapshot.house.name, rules: snapshot.rules, awayMakeup: snapshot.house.awayMakeup }}
                editable={view!.me?.role === 'admin'}
                saved={saved}
                onSaved={setSaved}
              />
            </GroupItem>
          </Group>
        );
      }}
    </HousePage>
  );
}
