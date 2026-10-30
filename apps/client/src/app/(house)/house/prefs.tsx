import { BEST_TIMES, PAGE_TITLE, STEADY_COPY, withRather, type BestTime, type MyPrefs } from '@app/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { saveMyPrefs } from '@/api/my-prefs';
import type { JohnList } from '@/api/settings';
import { Alert } from '@/components/alert';
import { DayChips } from '@/components/day-chips';
import { GroupItem } from '@/components/group';
import { HousePage } from '@/components/house/house-page';
import { PickMenu } from '@/components/pick-menu';
import { Row } from '@/components/row';
import { Section } from '@/components/section';
import { Segmented } from '@/components/segmented';
import { Meta } from '@/components/text';
import { useHouse } from '@/hooks/use-house';
import { useJohnList } from '@/hooks/use-john-list';
import { useMembership } from '@/hooks/use-membership';
import { useMove } from '@/hooks/use-move';
import { usePull } from '@/hooks/use-refresh';
import { INSET, LABEL_GAP, SECTION_GAP } from '@/theme';

const TIME_OPTIONS: readonly { value: BestTime | 'any'; label: string }[] = [
  { value: 'any', label: STEADY_COPY.anyTime },
  ...BEST_TIMES.map((value) => ({ value, label: STEADY_COPY.time[value] })),
];
const RATHER_OPTIONS = (['1', '0', '-1'] as const).map((value) => ({ value, label: STEADY_COPY.rather[value] }));

/**
 * Your preferences in this house, pushed from House, You: the days that
 * suit you, your best time (what Plan it offers first), and each John you'd
 * rather do or rather not. Each change saves as it's made; the deal reads
 * them each Monday, and everyone still does their fair share.
 */
export default function PrefsScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <PrefsFor houseId={house!.id} userId={session!.user.id} />;
}

function PrefsFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { query, view } = useHouse(houseId, userId);
  const list = useJohnList(houseId);
  const { refreshing, pull } = usePull(houseId, () => Promise.all([query.refetch(), list.refetch()]));
  const saved = view?.snapshot.members.find((m) => m.userId === userId)?.prefs ?? null;
  return (
    <HousePage
      title={PAGE_TITLE.prefs}
      testID="prefs-screen"
      ready={saved !== null && list.data !== undefined}
      failed={query.isError || list.isError}
      onRetry={() => void Promise.all([query.refetch(), list.refetch()])}
      refreshing={refreshing}
      onRefresh={pull}
    >
      {/* Whole values only: the React Compiler can hoist a field read out of this callback, before it's ready. */}
      {() => <PrefsForm houseId={houseId} saved={saved!} list={list.data!} />}
    </HousePage>
  );
}

function PrefsForm({ houseId, saved, list }: { houseId: string; saved: MyPrefs; list: JohnList }) {
  const { johns } = list;
  const move = useMove(houseId);
  // What you've picked, ahead of the save that follows each change.
  const [prefs, setPrefs] = useState(saved);

  function change(next: MyPrefs) {
    setPrefs(next);
    void move.run(() => saveMyPrefs(houseId, next));
  }

  return (
    <View style={styles.page}>
      {move.problem ? <Alert message={move.problem} /> : null}
      <Section label={STEADY_COPY.days} right={prefs.days.length ? undefined : STEADY_COPY.anyDay}>
        <GroupItem>
          <DayChips value={prefs.days} onChange={(days) => change({ ...prefs, days })} label={STEADY_COPY.days} testID="prefs-days" />
          <Meta>{STEADY_COPY.daysHint}</Meta>
        </GroupItem>
      </Section>
      <Section label={STEADY_COPY.bestTime}>
        <GroupItem>
          <Segmented
            options={TIME_OPTIONS}
            value={prefs.bestTime ?? 'any'}
            onChange={(t) => change({ ...prefs, bestTime: t === 'any' ? null : t })}
            label={STEADY_COPY.bestTime}
            equal
            testID="prefs-time"
          />
          <Meta>{STEADY_COPY.bestTimeHint}</Meta>
        </GroupItem>
      </Section>
      {johns.length ? (
        <View style={styles.noted}>
          <Section label={STEADY_COPY.johns} testID="prefs-johns">
            {johns.map((john) => (
              <Row
                key={john.id}
                title={john.name}
                trailing={
                  <PickMenu
                    options={RATHER_OPTIONS}
                    value={String(prefs.rather[john.id] ?? 0) as '1' | '0' | '-1'}
                    onChange={(v) => change(withRather(prefs, john.id, Number(v) as 1 | 0 | -1))}
                    label={john.name}
                    testID={`prefs-john-${john.id}`}
                  />
                }
                testID="prefs-john"
              />
            ))}
          </Section>
          <Meta style={styles.note}>{STEADY_COPY.prefsNote}</Meta>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: SECTION_GAP },
  noted: { gap: LABEL_GAP },
  // A line under a group, on the leading edge.
  note: { paddingHorizontal: INSET },
});
