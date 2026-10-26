import { describeEvent, FOCUS_SHELL_COPY, SECTION_LABEL, WALL_COPY } from '@app/core';
import { StyleSheet, View } from 'react-native';

import { Alert } from '@/components/alert';
import { Card } from '@/components/card';
import { PageTitle } from '@/components/page-title';
import { Reading, ReadFailed } from '@/components/read-state';
import { Screen } from '@/components/screen';
import { Body } from '@/components/text';
import { TitleBar } from '@/components/title-bar';
import { WallEventCard } from '@/components/wall-event';
import { useHouse } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { useNow } from '@/hooks/use-now';
import { usePull } from '@/hooks/use-refresh';
import { useReact, useWall } from '@/hooks/use-wall';
import { SPACE } from '@/theme';

/**
 * The whole Wall: what the house did, latest first, pushed from House. For
 * now the old Wall's content; the House track rebuilds it by day.
 */
export default function WallScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <WallFor houseId={house!.id} userId={session!.user.id} />;
}

function WallFor({ houseId, userId }: { houseId: string; userId: string }) {
  const now = useNow();
  const { view } = useHouse(houseId, userId);
  const wall = useWall(houseId, userId);
  const { react, problem } = useReact(houseId, userId);
  const { refreshing, pull } = usePull(houseId, wall.refetch);

  const members = view?.snapshot.members ?? [];
  // "You" in the sentences, as on the web; the plates show everyone's own name.
  const nameOf = (id: string | null) =>
    !id ? 'Someone' : id === userId ? 'You' : (members.find((m) => m.userId === id)?.name ?? FOCUS_SHELL_COPY.formerHousemate);
  const realName = (id: string) => members.find((m) => m.userId === id)?.name ?? 'Housemate';
  const currency = view?.snapshot.rules.currency ?? 'GBP';

  return (
    <Screen
      bar={<TitleBar title={WALL_COPY.title} back="/house" backLabel={SECTION_LABEL.house} />}
      refreshing={refreshing}
      onRefresh={pull}
      testID="wall-screen"
    >
      <PageTitle page={WALL_COPY.title} />
      <View style={styles.stack}>
        {problem ? <Alert message={problem} /> : null}

        {!wall.data ? (
          wall.isError ? (
            <ReadFailed message="Couldn't read the Wall. Check the connection." onRetry={() => void wall.refetch()} />
          ) : (
            <Reading label="Reading the Wall" />
          )
        ) : wall.data.events.length === 0 ? (
          <Card>
            <Body muted>{WALL_COPY.empty}</Body>
          </Card>
        ) : (
          wall.data.events.map((event) => (
            <WallEventCard
              key={event.id}
              event={event}
              line={describeEvent(event, nameOf, currency)}
              person={event.userId ? { name: realName(event.userId), me: event.userId === userId } : null}
              photoUrl={event.photoPath ? (wall.data.photos[event.photoPath] ?? null) : null}
              now={now}
              onReact={(kind, on) => react(event.id, kind, on)}
            />
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.md },
});
