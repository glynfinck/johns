import { describeEvent, PAGE_TITLE, WALL_COPY } from '@app/core';
import { RefreshCwIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { Body, Eyebrow, Heading } from '@/components/text';
import { WallEventCard } from '@/components/wall-event';
import { useCatchUp, useHouse } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { useNow } from '@/hooks/use-now';
import { useReact, useWall } from '@/hooks/use-wall';
import { SPACE, useTheme } from '@/theme';

/** The Wall: what the house did, latest first, as the web's /wall. */
export default function WallScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <WallFor houseId={house!.id} userId={session!.user.id} />;
}

function WallFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { colors } = useTheme();
  const now = useNow();
  const { view } = useHouse(houseId, userId);
  const wall = useWall(houseId, userId);
  const { react, problem } = useReact(houseId, userId);
  const [refreshing, setRefreshing] = useState(false);
  const freshen = useCatchUp(houseId);

  async function pull() {
    setRefreshing(true);
    if (!(await freshen())) await wall.refetch();
    setRefreshing(false);
  }

  const members = view?.snapshot.members ?? [];
  // "You" in the sentences, as on the web; the plates show everyone's own name.
  const nameOf = (id: string | null) =>
    !id ? 'Someone' : id === userId ? 'You' : (members.find((m) => m.userId === id)?.name ?? 'A former housemate');
  const realName = (id: string) => members.find((m) => m.userId === id)?.name ?? 'Housemate';
  const currency = view?.snapshot.rules.currency ?? 'GBP';

  return (
    <Screen refreshing={refreshing} onRefresh={() => void pull()}>
      <PageTitle page={PAGE_TITLE.wall} />
      <View style={styles.stack}>
        <View>
          <Eyebrow>{view?.snapshot.house.name ?? ''}</Eyebrow>
          <Heading style={styles.title}>{WALL_COPY.title}</Heading>
        </View>

        {problem ? <Alert message={problem} /> : null}

        {!wall.data ? (
          wall.isError ? (
            <View style={styles.stack}>
              <Alert message="Couldn't read the Wall. Check the connection." />
              <View style={styles.start}>
                <Button variant="outline" icon={RefreshCwIcon} label="Try again" onPress={() => void wall.refetch()} />
              </View>
            </View>
          ) : (
            <ActivityIndicator color={colors.foreground} accessibilityLabel="Reading the Wall" style={styles.loading} />
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
  start: { alignItems: 'flex-start' },
  loading: { marginTop: SPACE.xxl },
  title: { marginTop: SPACE.xs, marginBottom: SPACE.sm },
});
