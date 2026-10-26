import { dayLabel, isOpen, PAGE_TITLE, TODAY_COPY, weekRange } from '@app/core';
import { FlameIcon, RepeatIcon, ShieldIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AwayBanner } from '@/components/away-banner';
import { Card } from '@/components/card';
import { InviteCard } from '@/components/invite-card';
import { JohnCard } from '@/components/john-card';
import { NotDealt } from '@/components/not-dealt';
import { PageTitle } from '@/components/page-title';
import { Reading, ReadFailed } from '@/components/read-state';
import { Screen } from '@/components/screen';
import { StakeCard } from '@/components/stake-parts';
import { ShareCard, TableBeside } from '@/components/table-parts';
import { Body, Eyebrow } from '@/components/text';
import { TitleBar } from '@/components/title-bar';
import { useAway } from '@/hooks/use-away';
import { useHouse, type HouseView } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { usePull } from '@/hooks/use-refresh';
import { useStake } from '@/hooks/use-stake';
import { useTable } from '@/hooks/use-table';
import { FONT, RADIUS, SPACE, useTheme } from '@/theme';

/**
 * Today: your Johns this week, what's left, and the tick. For now the old
 * Today's content under Focus's title bar; the Today track rebuilds it.
 */
export default function Today() {
  const { session, house } = useMembership();
  // The layout's guard only shows Today with a house and a session.
  return <TodayFor houseId={house!.id} userId={session!.user.id} />;
}

function TodayFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { query, view } = useHouse(houseId, userId);
  const { refreshing, pull } = usePull(houseId, query.refetch);

  return (
    <Screen
      bar={
        <TitleBar
          title={PAGE_TITLE.today}
          right={view ? dayLabel(view.now, view.snapshot.rules.timezone) : undefined}
        />
      }
      refreshing={refreshing}
      onRefresh={pull}
      testID="today-screen"
    >
      <PageTitle page={PAGE_TITLE.today} />
      {view ? (
        <Week view={view} />
      ) : query.isError ? (
        <ReadFailed onRetry={() => void query.refetch()} />
      ) : (
        <Reading />
      )}
    </Screen>
  );
}

function Week({ view }: { view: HouseView }) {
  const { colors } = useTheme();
  const { snapshot, board, today, me, now } = view;
  const table = useTable(snapshot.house.id, snapshot);
  const stake = useStake(snapshot.house.id, snapshot);
  const away = useAway(snapshot.house.id, snapshot);
  const myBalance = table.data?.balances.find((b) => b.userId === me?.userId);
  const { rules, house, members } = snapshot;
  const admin = members.find((m) => m.role === 'admin');
  const nameOf = (userId: string) => members.find((m) => m.userId === userId)?.name ?? 'Housemate';

  return (
    <View style={styles.stack}>
      <Eyebrow>
        {board.week ? TODAY_COPY.thisWeekRange(weekRange(board.week.startsAt, board.week.endsAt, rules.timezone)) : TODAY_COPY.thisWeek}
      </Eyebrow>

      {away.data && me ? (
        <AwayBanner periods={away.data.periods} me={me.userId} today={away.data.today} makeup={house.awayMakeup} />
      ) : null}

      {!board.week ? (
        <>
          <NotDealt houseId={house.id} notStarted={board.notStarted} isAdmin={me?.role === 'admin'} adminName={admin?.name ?? 'An admin'} />
          <InviteCard code={house.joinCode} houseName={house.name} />
        </>
      ) : (
        <>
          <Card style={[styles.hero, { borderLeftColor: colors.hivis }]}>
            <Text style={[styles.left, { color: colors.foreground }]} testID="johns-left">
              {today.left}
            </Text>
            <View style={styles.heroText}>
              <Text style={[styles.heroLabel, { color: colors.foreground }]}>{TODAY_COPY.left(today.left)}</Text>
              <View style={styles.bars} aria-hidden>
                {today.mine.map((i) => (
                  <View
                    key={i.id}
                    style={[styles.bar, { backgroundColor: isOpen(i.status) ? colors.secondary : colors.good }]}
                  />
                ))}
              </View>
            </View>
            {me ? (
              <View style={styles.perks}>
                <View style={[styles.streak, { backgroundColor: colors.hivis }]}>
                  <FlameIcon size={14} color={colors.onHivis} aria-hidden />
                  <Text style={[styles.streakText, { color: colors.onHivis }]}>{TODAY_COPY.streak(me.streak)}</Text>
                </View>
                {me.immunityTokens > 0 ? (
                  <View style={styles.perk}>
                    <ShieldIcon size={14} color={colors.mutedForeground} aria-hidden />
                    <Body muted style={styles.perkText}>
                      {TODAY_COPY.immunity(me.immunityTokens)}
                    </Body>
                  </View>
                ) : null}
                {me.swapTokens > 0 ? (
                  <View style={styles.perk}>
                    <RepeatIcon size={14} color={colors.foreground} aria-hidden />
                    <Body style={styles.perkText}>{TODAY_COPY.swapReady}</Body>
                  </View>
                ) : null}
              </View>
            ) : null}
          </Card>

          {today.toVote.length > 0 ? (
            <View style={styles.stack} testID="to-vote">
              <Eyebrow>{TODAY_COPY.toVote}</Eyebrow>
              {today.toVote.map((item) => (
                <JohnCard
                  key={item.id}
                  item={item}
                  houseId={house.id}
                  zone={rules.timezone}
                  now={now}
                  mine={false}
                  ownerName={nameOf(item.userId)}
                  showOwner
                />
              ))}
              <Eyebrow style={styles.yours}>{TODAY_COPY.yours}</Eyebrow>
            </View>
          ) : null}

          {today.mine.length === 0 ? (
            <Card>
              <Body muted>{TODAY_COPY.nothingYours}</Body>
            </Card>
          ) : (
            today.mine.map((item) => (
              <JohnCard
                key={item.id}
                item={item}
                houseId={house.id}
                zone={rules.timezone}
                now={now}
                immunityTokens={me?.immunityTokens ?? 0}
              />
            ))
          )}

          <TableBeside rows={board.table} people={{ me: me?.userId ?? '', nameOf }} />
          {myBalance ? <ShareCard balance={myBalance} /> : null}
          {stake.data ? <StakeCard stake={stake.data} me={me?.userId ?? ''} currency={rules.currency} /> : null}

          {members.length < 2 ? <InviteCard code={house.joinCode} houseName={house.name} /> : null}
        </>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  yours: { marginTop: SPACE.sm },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
    padding: SPACE.lg,
    borderLeftWidth: 10,
    borderRadius: RADIUS * 1.4,
  },
  left: { fontFamily: FONT.black, fontSize: 52, lineHeight: 56 },
  heroText: { flex: 1, minWidth: 0 },
  heroLabel: { fontFamily: FONT.extrabold, fontSize: 16 },
  bars: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, marginTop: SPACE.sm },
  bar: { height: 6, width: 28, borderRadius: 2 },
  perks: { alignItems: 'flex-end', gap: SPACE.xs },
  streak: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, borderRadius: 4, paddingHorizontal: SPACE.sm, paddingVertical: 4 },
  streakText: { fontFamily: FONT.black, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  perkText: { fontSize: 12 },
});
