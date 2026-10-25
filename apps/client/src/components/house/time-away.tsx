import {
  addDaysTo,
  AWAY_COPY,
  awayOn,
  dateRange,
  datesBetween,
  firstName,
  isoDayOf,
  type AwayPeriod,
  type IsoDow,
} from '@app/core';
import { PlaneIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cancelAway, setAway } from '@/api/away';
import type { Housemate } from '@/api/board';
import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { DateRangePicker, type DateRange } from '@/components/date-range';
import { Field } from '@/components/field';
import { Body } from '@/components/text';
import { useMove } from '@/hooks/use-move';
import { FONT, RADIUS, SPACE, useTheme } from '@/theme';

/**
 * Who's away over the next four weeks, one row each, a square a day, as the
 * web's calendar. The house's weeks are spaced apart so it's plain which deal
 * a trip falls in. The squares are a picture; the list under them says the
 * same in words.
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
  const upcoming = periods.filter((p) => p.endsOn >= today);
  const nameOf = (id: string) => people.find((p) => p.userId === id)?.name ?? 'A former housemate';

  return (
    <View style={styles.stack}>
      <View aria-hidden style={styles.grid}>
        {people.map((p) => (
          <View key={p.userId} style={styles.line}>
            <View style={styles.who}>
              <Avatar name={p.name} me={p.userId === me} size={20} />
              <Text numberOfLines={1} style={[styles.whoName, { color: colors.foreground }]}>
                {p.userId === me ? 'You' : firstName(p.name)}
              </Text>
            </View>
            <View style={styles.squares}>
              {dates.map((d) => (
                <View
                  key={d}
                  style={[
                    styles.square,
                    { backgroundColor: awayOn(periods, p.userId, d) ? colors.foreground : colors.secondary },
                    d !== today && isoDayOf(d) === weekStarts && styles.weekGap,
                    d === today && { borderColor: colors.hivis, borderWidth: 2 },
                  ]}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
      {upcoming.length === 0 ? (
        <Body muted style={styles.small}>
          {AWAY_COPY.nobody}
        </Body>
      ) : (
        <View style={styles.list}>
          {upcoming.map((p) => (
            <View key={p.id} testID="away-period" style={styles.trip}>
              <Text style={[styles.bold, { color: colors.foreground }]}>{p.userId === me ? 'You' : nameOf(p.userId)}</Text>
              <Text style={[styles.text, { color: colors.foreground }]}>{dateRange(p.startsOn, p.endsOn)}</Text>
              {p.note ? <Text style={[styles.text, { color: colors.mutedForeground }]}>{p.note}</Text> : null}
              {p.startsOn <= today ? (
                <Text style={[styles.now, { color: colors.mutedForeground }]}>{AWAY_COPY.awayNow}</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Your own trips, each with a way to cancel it or to come back early. */
export function MyTrips({ houseId, periods, today }: { houseId: string; periods: AwayPeriod[]; today: string }) {
  if (periods.length === 0) return null;
  return (
    <View style={styles.list}>
      {periods.map((p) => (
        <TripRow key={p.id} houseId={houseId} period={p} today={today} />
      ))}
    </View>
  );
}

function TripRow({ houseId, period, today }: { houseId: string; period: AwayPeriod; today: string }) {
  const { colors } = useTheme();
  const move = useMove(houseId);
  const started = period.startsOn <= today;
  return (
    <View testID="my-trip">
      <View style={[styles.mine, { borderColor: colors.border }]}>
        <PlaneIcon size={16} color={colors.mutedForeground} aria-hidden />
        <View style={styles.grow}>
          <Text style={[styles.bold, { color: colors.foreground }]}>{dateRange(period.startsOn, period.endsOn)}</Text>
          {period.note ? <Text style={[styles.small, { color: colors.mutedForeground }]}>{period.note}</Text> : null}
        </View>
        <Button
          variant="ghost"
          label={started ? AWAY_COPY.back : AWAY_COPY.cancel}
          disabled={move.pending}
          onPress={() => void move.run(() => cancelAway(period.id))}
        />
      </View>
      {move.problem ? <Alert message={move.problem} /> : null}
    </View>
  );
}

/** Book time away for yourself: the days from a calendar, and where. */
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
    <View style={styles.stack} testID="away-form">
      <DateRangePicker
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
        <Body style={styles.small}>{status}</Body>
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
          <Body muted style={styles.small}>
            {AWAY_COPY.moved(moved)}
          </Body>
        </View>
      ) : null}
      <View style={styles.start}>
        <Button
          icon={PlaneIcon}
          label={move.pending ? AWAY_COPY.booking : AWAY_COPY.book}
          disabled={move.pending || !range.from || !range.to}
          onPress={() => void book()}
          testID="book-away"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.md },
  grid: { gap: SPACE.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  who: { width: 76, flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  whoName: { flexShrink: 1, fontFamily: FONT.bold, fontSize: 12 },
  squares: { flex: 1, flexDirection: 'row', gap: 2 },
  square: { flex: 1, height: 16, borderRadius: 2 },
  weekGap: { marginLeft: 3 },
  list: { gap: SPACE.sm },
  trip: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: SPACE.sm },
  mine: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, borderWidth: 1, borderRadius: RADIUS, paddingLeft: SPACE.md, paddingRight: SPACE.xs, minHeight: 52 },
  grow: { flex: 1, minWidth: 0 },
  bold: { fontFamily: FONT.bold, fontSize: 14 },
  text: { fontFamily: FONT.regular, fontSize: 14 },
  now: { fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  small: { fontSize: 13, lineHeight: 18 },
  start: { alignItems: 'flex-start' },
});
