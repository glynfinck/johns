import { SECTION_LABEL, WALL_COPY, WALL_FEED_COPY, wallDays, wallFeedRow, type WallFeedRow } from '@app/core';
import { MegaphoneIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Fold } from '@/components/fold';
import { useJohnSheet } from '@/components/john-sheet';
import { PageTitle } from '@/components/page-title';
import { Reading, ReadFailed } from '@/components/read-state';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { Meta } from '@/components/text';
import { TitleBar } from '@/components/title-bar';
import { WallEventSheet } from '@/components/wall/event-sheet';
import { WallEventRow, WallPhoto, wallScene } from '@/components/wall/wall-row';
import { useHouse } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { usePull } from '@/hooks/use-refresh';
import { useReact, useWallFeed, wallPages } from '@/hooks/use-wall';
import { INSET, SPACE } from '@/theme';

/**
 * The whole Wall, pushed from House: what the house did, a day at a time,
 * latest first, with several ticks by one person in a row folded into one,
 * photo receipts under their ticks, and older days on request. A row about
 * this week's John opens it in the John sheet; any other opens the event in
 * full. Holding a row down shows it with all four reactions.
 */
export default function WallScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <WallFor houseId={house!.id} userId={session!.user.id} />;
}

function WallFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { query, view } = useHouse(houseId, userId);
  const feed = useWallFeed(houseId, userId);
  const johnSheet = useJohnSheet();
  const { react, problem, problemAt, clear } = useReact(houseId, userId);
  const { refreshing, pull } = usePull(houseId, feed.refetch);
  const [open, setOpen] = useState<string | null>(null);

  const { events, photos } = wallPages(feed.data?.pages ?? []);
  const scene = view ? wallScene(view, userId, events, true) : null;
  const rows = scene ? events.map((e) => wallFeedRow(e, scene)) : [];
  const shown = open ? rows.find((r) => r.id === open) : undefined;
  if (open && feed.data && scene && !shown) setOpen(null);

  function show(eventId: string) {
    // Another event's refusal stays with that event's row, not in this sheet.
    if (problemAt !== eventId) clear();
    setOpen(eventId);
  }

  const rowOf = (row: WallFeedRow) => (
    <View key={row.id}>
      <WallEventRow
        row={row}
        problem={problemAt === row.id && open !== row.id ? problem : null}
        onReact={(kind, on) => react(row.id, kind, on)}
        onPress={() =>
          row.board ? johnSheet.open(row.board.assignmentId, row.board.vote ? 'vote' : undefined) : show(row.id)
        }
        onReactions={() => show(row.id)}
      />
      {row.photoPath && photos[row.photoPath] ? <WallPhoto uri={photos[row.photoPath]} john={row.john} /> : null}
    </View>
  );

  let body;
  if (!feed.data || !view || !scene) {
    // The Wall's rows need the house too (who lives here, this week's board): either read failing says so.
    body =
      feed.isError || query.isError ? (
        <ReadFailed
          message={WALL_FEED_COPY.unreadable}
          onRetry={() => {
            if (feed.isError) void feed.refetch();
            if (query.isError) void query.refetch();
          }}
        />
      ) : (
        <Reading label={WALL_FEED_COPY.reading} />
      );
  } else if (rows.length === 0) {
    body = <EmptyState icon={MegaphoneIcon} title={WALL_FEED_COPY.emptyTitle} body={WALL_COPY.empty} testID="wall-empty" />;
  } else {
    const days = wallDays(rows, scene.zone, scene.now);
    body = (
      <>
        {days.map((day) => (
          <Section key={day.date} label={day.label} testID="wall-day">
            {day.items.map((item) =>
              'fold' in item ? (
                <Fold
                  key={item.fold.id}
                  label={item.fold.label}
                  meta={<Meta>{item.fold.rows[0].when}</Meta>}
                  testID="wall-fold"
                >
                  {item.fold.rows.map(rowOf)}
                </Fold>
              ) : (
                rowOf(item.row)
              ),
            )}
          </Section>
        ))}
        <View style={styles.foot}>
          {feed.isFetchNextPageError ? <Alert message={WALL_FEED_COPY.unreadable} /> : null}
          {feed.hasNextPage ? (
            <Button
              variant="outline"
              label={WALL_FEED_COPY.loadOlder}
              disabled={feed.isFetchingNextPage}
              onPress={() => void feed.fetchNextPage()}
              testID="load-older"
            />
          ) : (
            <Meta>{WALL_FEED_COPY.everything}</Meta>
          )}
        </View>
      </>
    );
  }

  return (
    <Screen
      bar={<TitleBar title={WALL_COPY.title} back="/house" backLabel={SECTION_LABEL.house} />}
      refreshing={refreshing}
      onRefresh={pull}
      testID="wall-screen"
    >
      <PageTitle page={WALL_COPY.title} />
      {body}
      <WallEventSheet
        row={shown ?? null}
        problem={shown && problemAt === shown.id ? problem : null}
        onReact={(kind, on) => shown && react(shown.id, kind, on)}
        onClose={() => setOpen(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  foot: { paddingHorizontal: INSET, gap: SPACE.md, alignItems: 'flex-start' },
});
