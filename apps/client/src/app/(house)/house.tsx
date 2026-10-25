import { AWAY_COPY, DEAL_COPY, GROUPS_COPY, HOUSE_COPY } from '@app/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Alert } from '@/components/alert';
import { Card } from '@/components/card';
import { DealButton } from '@/components/house/deal-button';
import { GroupsList } from '@/components/house/groups-list';
import { JohnList } from '@/components/house/john-list';
import { MeCard } from '@/components/house/me-card';
import { MembersList } from '@/components/house/members-list';
import { RulesForm } from '@/components/house/rules-form';
import { AwayCalendar, AwayForm, MyTrips } from '@/components/house/time-away';
import { InviteCard } from '@/components/invite-card';
import { Screen } from '@/components/screen';
import { Body, Eyebrow, Heading } from '@/components/text';
import { useAway } from '@/hooks/use-away';
import { useCatchUp, useHouse } from '@/hooks/use-house';
import { useJohnList } from '@/hooks/use-john-list';
import { useMembership } from '@/hooks/use-membership';
import { SPACE, useTheme, WIDE } from '@/theme';

/**
 * House, as the web's /house: the John list and the deal, the house rules,
 * the invite, who lives here, and you. Admins change the list and the
 * rules; everyone reads them. After this the phone can run a house from
 * nothing.
 */
export default function HouseScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <HouseFor houseId={house!.id} userId={session!.user.id} />;
}

function Panel({ title, children, testID }: { title: string; children: ReactNode; testID?: string }) {
  return (
    <Card style={styles.panel}>
      <View testID={testID} style={styles.panelBody}>
        <Eyebrow>{title}</Eyebrow>
        {children}
      </View>
    </Card>
  );
}

function HouseFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { colors } = useTheme();
  const wide = useWindowDimensions().width >= WIDE;
  const { query, view } = useHouse(houseId, userId);
  const list = useJohnList(houseId);
  const away = useAway(houseId, query.data);
  const [refreshing, setRefreshing] = useState(false);
  const [rulesSaved, setRulesSaved] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const freshen = useCatchUp(houseId);

  // The rules, the list, the groups and who lives here aren't sent over
  // Realtime (only ticks, disputes and the Wall are), and the house was
  // likely read a moment ago by another tab, so read them each time House
  // comes into view. (The list's first read is its own, just now.)
  const seen = useRef(false);
  const { refetch: refetchHouse } = query;
  const { refetch: refetchList } = list;
  const { refetch: refetchAway } = away;
  useFocusEffect(
    useCallback(() => {
      void refetchHouse();
      if (seen.current) void Promise.all([refetchList(), refetchAway()]);
      seen.current = true;
    }, [refetchHouse, refetchList, refetchAway]),
  );

  async function pull() {
    setRefreshing(true);
    if (!(await freshen())) await Promise.all([query.refetch(), list.refetch(), away.refetch()]);
    setRefreshing(false);
  }

  const snapshot = view?.snapshot;
  const isAdmin = view?.me?.role === 'admin';

  return (
    <Screen maxWidth={wide ? 1152 : 720} refreshing={refreshing} onRefresh={() => void pull()} testID="house-screen">
      <View style={styles.stack}>
        <View>
          <Eyebrow>{HOUSE_COPY.eyebrow}</Eyebrow>
          <Heading style={styles.title}>{snapshot?.house.name ?? ''}</Heading>
        </View>

        {query.isError || list.isError || away.isError ? <Alert message="Couldn't read the house. Check the connection." /> : null}

        {!snapshot || !list.data || !away.data ? (
          <ActivityIndicator color={colors.foreground} accessibilityLabel="Reading the house" style={styles.loading} />
        ) : (
          <View style={[styles.columns, wide && styles.columnsWide]}>
            <View style={[styles.column, wide && styles.main]}>
              <Panel title={HOUSE_COPY.johns} testID="john-panel">
                <JohnList
                  houseId={houseId}
                  rules={snapshot.rules}
                  johns={list.data.johns}
                  groups={list.data.groups}
                  editable={isAdmin}
                />
                {isAdmin && list.data.johns.length > 0 ? (
                  <View style={[styles.deal, { borderTopColor: colors.border }]}>
                    <Body muted style={styles.small}>
                      {snapshot.house.everDealt ? DEAL_COPY.againBody : DEAL_COPY.firstBody}
                    </Body>
                    <DealButton houseId={houseId} started={snapshot.house.everDealt} />
                  </View>
                ) : null}
              </Panel>
              <Panel title={GROUPS_COPY.title}>
                <GroupsList houseId={houseId} groups={list.data.groups} people={snapshot.members} me={userId} editable={isAdmin} />
              </Panel>
              <Panel title={HOUSE_COPY.rules}>
                <RulesForm
                  // A fresh form whenever the house's rules change underneath it.
                  key={JSON.stringify([snapshot.house.name, snapshot.rules, snapshot.house.awayMakeup])}
                  houseId={houseId}
                  values={{ name: snapshot.house.name, rules: snapshot.rules, awayMakeup: snapshot.house.awayMakeup }}
                  editable={isAdmin}
                  saved={rulesSaved}
                  onSaved={setRulesSaved}
                />
              </Panel>
            </View>
            <View style={[styles.column, wide && styles.side]}>
              <InviteCard code={snapshot.house.joinCode} houseName={snapshot.house.name} />
              <Panel title={AWAY_COPY.title} testID="away-panel">
                <AwayCalendar
                  periods={away.data.periods}
                  people={snapshot.members}
                  me={userId}
                  today={away.data.today}
                  weekStarts={snapshot.rules.weekStarts}
                />
                <View style={[styles.yours, { borderTopColor: colors.border }]}>
                  <Heading level={3}>{AWAY_COPY.yours}</Heading>
                  <MyTrips
                    houseId={houseId}
                    periods={away.data.periods.filter((p) => p.userId === userId && p.endsOn >= away.data.today)}
                    today={away.data.today}
                  />
                  <Body muted style={styles.small}>
                    {AWAY_COPY.howItWorks}
                  </Body>
                  <AwayForm houseId={houseId} today={away.data.today} weekStarts={snapshot.rules.weekStarts} />
                </View>
              </Panel>
              <Panel title={HOUSE_COPY.members}>
                <MembersList houseId={houseId} members={snapshot.members} me={userId} isAdmin={isAdmin} />
              </Panel>
              {view.me ? (
                <Panel title={HOUSE_COPY.you}>
                  <MeCard
                    key={view.me.name}
                    houseId={houseId}
                    userId={userId}
                    name={view.me.name}
                    saved={nameSaved}
                    onSaved={setNameSaved}
                  />
                </Panel>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  title: { marginTop: SPACE.xs },
  loading: { marginTop: SPACE.xxl },
  columns: { gap: SPACE.lg },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { gap: SPACE.lg },
  main: { flex: 1, minWidth: 0 },
  side: { width: 380 },
  panel: { padding: SPACE.xl },
  panelBody: { gap: SPACE.lg },
  deal: { gap: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACE.lg },
  yours: { gap: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACE.lg },
  small: { fontSize: 13, lineHeight: 18 },
});
