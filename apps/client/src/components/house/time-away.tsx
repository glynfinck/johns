import {
  addDaysTo,
  AWAY_COPY,
  awayMeta,
  awayOn,
  dateRange,
  datesBetween,
  firstName,
  FOCUS_SHELL_COPY,
  isoDayOf,
  SETUP_COPY,
  tripMeta,
  tripStarted,
  upcomingTrips,
  type AwayPeriod,
  type IsoDow,
} from '@app/core';
import { PlaneIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { cancelAway, setAway } from '@/api/away';
import type { Housemate } from '@/api/board';
import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { GroupItem } from '@/components/group';
import { Row, RowIcon } from '@/components/row';
import { AwayDates, type DateRange } from '@/components/setup/away-dates';
import { Chip } from '@/components/status-mark';
import { Body, Meta } from '@/components/text';
import { TextButton } from '@/components/text-button';
import { useMove } from '@/hooks/use-move';
import { SPACE, useTheme } from '@/theme';

/**
 * Who's away over the next four weeks, for a group: a square a day for each
 * housemate, you included (the house's weeks spaced apart, so it's plain
 * which deal a trip falls in, today ringed), then each housemate's trip
 * still to come as a row that says the same in words. Your own trips are
 * the page's "Your time away", so they aren't listed twice. The squares are
 * a picture; the rows are what a screen reader hears.
 */
export function AwayCalendar({
  periods,
  people,
  me,
  today,
  weekStarts,
  days = 28,
}: {
  periods: AwayPeriod[];
  people: Housemate[];
  me: string;
  today: string;
  weekStarts: IsoDow;
  days?: number;
}) {
  const { colors } = useTheme();
  const dates = datesBetween(today, addDaysTo(today, days - 1));
  const upcoming = upcomingTrips(periods, today);
  const others = upcoming.filter((p) => p.userId !== me);
  const person = (id: string) => people.find((p) => p.userId === id);

  return (
    <>
      <GroupItem testID="away-grid">
        <Meta>{SETUP_COPY.nextWeeks(dateRange(today, dates[dates.length - 1]))}</Meta>
        <View aria-hidden style={styles.grid}>
          {people.map((p) => (
            <View key={p.userId} style={styles.line}>
              <Meta numberOfLines={1} style={styles.who}>
                {p.userId === me ? SETUP_COPY.you : firstName(p.name)}
              </Meta>
              <View style={styles.squares}>
                {dates.map((d) => (
                  <View
                    key={d}
                    style={[
                      styles.square,
                      { backgroundColor: awayOn(periods, p.userId, d) ? colors.foreground : colors.secondary },
                      d !== today && isoDayOf(d) === weekStarts && styles.weekGap,
                      d === today && { borderColor: colors.foreground, borderWidth: 2 },
                    ]}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      </GroupItem>
      {others.length === 0 ? (
        <GroupItem>
          <Body>{upcoming.length === 0 ? AWAY_COPY.nobody : SETUP_COPY.nobodyElse}</Body>
        </GroupItem>
      ) : (
        others.map((p) => {
          const who = person(p.userId);
          return (
            <Row
              key={p.id}
              leading={<Avatar name={who?.name ?? FOCUS_SHELL_COPY.formerHousemate} />}
              title={who ? firstName(who.name) : FOCUS_SHELL_COPY.formerHousemate}
              meta={awayMeta(p)}
              trailing={tripStarted(p, today) ? <Chip label={SETUP_COPY.awayNow} icon={PlaneIcon} /> : undefined}
              testID="away-period"
            />
          );
        })
      )}
    </>
  );
}

/** Your own trips still to come, as rows for a group, each with a way to cancel it or to come back early. */
export function MyTrips({ houseId, periods, today }: { houseId: string; periods: AwayPeriod[]; today: string }) {
  if (periods.length === 0) return null;
  return (
    <>
      {periods.map((p) => (
        <TripRow key={p.id} houseId={houseId} period={p} today={today} />
      ))}
    </>
  );
}

function TripRow({ houseId, period, today }: { houseId: string; period: AwayPeriod; today: string }) {
  const move = useMove(houseId);
  const range = dateRange(period.startsOn, period.endsOn);
  const label = tripStarted(period, today) ? AWAY_COPY.back : AWAY_COPY.cancel;
  return (
    <>
      <Row
        leading={<RowIcon icon={PlaneIcon} />}
        title={range}
        meta={tripMeta(period, today) || undefined}
        trailing={
          <TextButton
            label={label}
            align="end"
            accessibilityLabel={`${label}, ${range}`}
            disabled={move.pending}
            onPress={() => void move.run(() => cancelAway(period.id))}
          />
        }
        testID="my-trip"
      />
      {move.problem ? (
        <GroupItem>
          <Alert message={move.problem} />
        </GroupItem>
      ) : null}
    </>
  );
}

/**
 * Book time away for yourself, as one item in a group: how it works, the
 * days from a calendar that opens on this week, where, and Book, the page's
 * one amber button. What booking moved is said under it.
 */
export function AwayForm({ houseId, today, weekStarts }: { houseId: string; today: string; weekStarts: IsoDow }) {
  const move = useMove(houseId);
  const [range, setRange] = useState<DateRange>({ from: null, to: null });
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState('');
  const [moved, setMoved] = useState<number | null>(null);

  async function book() {
    if (!range.from || !range.to) return;
    let count = 0;
    const ok = await move.run(async () => {
      count = await setAway({ from: range.from!, to: range.to!, note });
    });
    if (!ok) return;
    setMoved(count);
    setRange({ from: null, to: null });
    setNote('');
  }

  const status = picking ? AWAY_COPY.pickTo : range.from && range.to ? AWAY_COPY.picked(dateRange(range.from, range.to)) : AWAY_COPY.pickFrom;

  return (
    <GroupItem testID="away-form">
      <Meta>{AWAY_COPY.howItWorks}</Meta>
      <AwayDates
        today={today}
        weekStarts={weekStarts}
        value={range}
        onChange={(next, stillPicking) => {
          setMoved(null);
          setRange(next);
          setPicking(stillPicking);
        }}
      />
      <View accessibilityLiveRegion="polite" testID="away-picked">
        <Body>{status}</Body>
      </View>
      <Field
        label={AWAY_COPY.note}
        placeholder={AWAY_COPY.notePlaceholder}
        value={note}
        onChangeText={setNote}
        maxLength={60}
        testID="away-note"
      />
      {move.problem ? <Alert message={move.problem} /> : null}
      {moved ? (
        <View accessibilityLiveRegion="polite">
          <Meta>{AWAY_COPY.moved(moved)}</Meta>
        </View>
      ) : null}
      <View style={styles.start}>
        <Button
          icon={PlaneIcon}
          label={move.pending ? AWAY_COPY.booking : SETUP_COPY.book}
          disabled={move.pending || !range.from || !range.to}
          onPress={() => void book()}
          testID="book-away"
        />
      </View>
    </GroupItem>
  );
}

const styles = StyleSheet.create({
  grid: { gap: SPACE.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  who: { width: 64 },
  squares: { flex: 1, flexDirection: 'row', gap: 2 },
  square: { flex: 1, height: 16, borderRadius: 2 },
  weekGap: { marginLeft: 3 },
  start: { alignItems: 'flex-start' },
});
