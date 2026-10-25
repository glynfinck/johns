import { isOpen, SIGN_IN_COPY, TODAY_COPY, weekRange } from '@app/core';
import { FlameIcon, LogOutIcon, RefreshCwIcon, RepeatIcon, ShieldIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { signOut } from '@/api/auth';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { InviteCard } from '@/components/invite-card';
import { JohnCard } from '@/components/john-card';
import { NotDealt } from '@/components/not-dealt';
import { Screen } from '@/components/screen';
import { Body, Eyebrow, Heading } from '@/components/text';
import { useCatchUp, useHouse, type HouseView } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { FONT, RADIUS, SPACE, useTheme } from '@/theme';

/** Today: your Johns this week, what's left, and the tick, as the web's Today. */
export default function Today() {
  const { session, house } = useMembership();
  // The layout's guard only shows Today with a house and a session.
  return <TodayFor houseId={house!.id} userId={session!.user.id} />;
}

function TodayFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { colors } = useTheme();
  const { query, view } = useHouse(houseId, userId);
  const [refreshing, setRefreshing] = useState(false);
  const freshen = useCatchUp(houseId);

  async function pull() {
    setRefreshing(true);
    if (!(await freshen())) await query.refetch();
    setRefreshing(false);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => void pull()}>
      {!view ? (
        query.isError ? (
          <View style={styles.stack}>
            <Alert message="Couldn't read the house. Check the connection." />
            <View style={styles.start}>
              <Button variant="outline" icon={RefreshCwIcon} label="Try again" onPress={() => void query.refetch()} />
            </View>
          </View>
        ) : (
          <ActivityIndicator color={colors.foreground} accessibilityLabel="Reading the house" style={styles.loading} />
        )
      ) : (
        <Week view={view} />
      )}
    </Screen>
  );
}

function Week({ view }: { view: HouseView }) {
  const { colors } = useTheme();
  const { snapshot, board, today, me, now } = view;
  const { rules, house, members } = snapshot;
  const admin = members.find((m) => m.role === 'admin');
  const nameOf = (userId: string) => members.find((m) => m.userId === userId)?.name ?? 'Housemate';

  return (
    <View style={styles.stack}>
      <View>
        <Eyebrow>
          {board.week ? TODAY_COPY.thisWeekRange(weekRange(board.week.startsAt, board.week.endsAt, rules.timezone)) : TODAY_COPY.thisWeek}
        </Eyebrow>
        <Heading style={styles.title}>{TODAY_COPY.title}</Heading>
      </View>

      {!board.week ? (
        <>
          <NotDealt notStarted={board.notStarted} isAdmin={me?.role === 'admin'} adminName={admin?.name ?? 'An admin'} />
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

          {members.length < 2 ? <InviteCard code={house.joinCode} houseName={house.name} /> : null}
        </>
      )}

      <SignOut name={me?.name} />
    </View>
  );
}

/** Who's signed in, and the way out, until House (Phase 11) has them. */
function SignOut({ name }: { name?: string }) {
  const [leaving, setLeaving] = useState(false);
  async function leave() {
    setLeaving(true);
    try {
      await signOut();
    } catch (reason) {
      // The guard moves on once the session is gone; anything else, try again.
      console.warn('Sign out failed', reason);
      setLeaving(false);
    }
  }
  return (
    <View style={styles.footer}>
      {name ? <Body muted style={styles.perkText}>{`Signed in as ${name}`}</Body> : null}
      <Button
        variant="ghost"
        icon={LogOutIcon}
        label={SIGN_IN_COPY.signOut}
        disabled={leaving}
        onPress={() => void leave()}
        testID="sign-out"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  start: { alignItems: 'flex-start' },
  loading: { marginTop: SPACE.xxl },
  title: { marginTop: SPACE.xs },
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
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACE.xl },
});
