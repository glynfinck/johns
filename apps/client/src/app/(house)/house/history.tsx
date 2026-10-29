import { HISTORY_COPY, SECTION_LABEL } from '@app/core';

import { HistoryList, type HistoryScene } from '@/components/house/history-list';
import { PageTitle } from '@/components/page-title';
import { Reading, ReadFailed } from '@/components/read-state';
import { Screen } from '@/components/screen';
import { TitleBar } from '@/components/title-bar';
import { useHistory } from '@/hooks/use-history';
import { useHouse } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { usePull } from '@/hooks/use-refresh';

/**
 * History, pushed from House's setup: every move in the house, newest
 * first, with Undo while it still reaches.
 */
export default function HistoryScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <HistoryFor houseId={house!.id} userId={session!.user.id} />;
}

function HistoryFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { query, view } = useHouse(houseId, userId);
  const history = useHistory(houseId);
  const { refreshing, pull } = usePull(houseId, history.refetch);

  let body;
  if (!history.data || !view) {
    body =
      history.isError || query.isError ? (
        <ReadFailed
          message={HISTORY_COPY.unreadable}
          onRetry={() => {
            if (history.isError) void history.refetch();
            if (query.isError) void query.refetch();
          }}
        />
      ) : (
        <Reading label={HISTORY_COPY.reading} />
      );
  } else {
    const names = new Map(view.snapshot.members.map((m) => [m.userId, m.name]));
    const scene: HistoryScene = {
      houseId,
      me: userId,
      zone: view.snapshot.rules.timezone,
      currency: view.snapshot.rules.currency,
      now: view.now,
      nameOf: (id) => (id === userId ? 'You' : ((id && names.get(id)) ?? HISTORY_COPY.someone)),
      fullName: (id) => (id && names.get(id)) ?? HISTORY_COPY.someone,
    };
    body = (
      <HistoryList
        items={history.data.pages.flat()}
        scene={scene}
        more={{
          has: history.hasNextPage,
          busy: history.isFetchingNextPage,
          failed: history.isFetchNextPageError,
          load: () => void history.fetchNextPage(),
        }}
      />
    );
  }

  return (
    <Screen
      bar={<TitleBar title={HISTORY_COPY.title} back="/house" backLabel={SECTION_LABEL.house} />}
      refreshing={refreshing}
      onRefresh={pull}
      testID="history-screen"
    >
      <PageTitle page={HISTORY_COPY.title} />
      {body}
    </Screen>
  );
}
