import { AWAY_COPY, DOW_LABEL, isoDayOf, monthGrid, monthLabel, shiftMonth, type IsoDow } from '@app/core';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FONT, RADIUS, SPACE, TAP, useTheme } from '@/theme';

export interface DateRange {
  from: string | null;
  to: string | null;
}

/** "Monday 26 October", for a screen reader. */
function spoken(date: string): string {
  return `${DOW_LABEL[isoDayOf(date)]} ${Number(date.slice(8))} ${monthLabel(date.slice(0, 7)).split(' ')[0]}`;
}

/**
 * Pick a run of days from a month calendar, as the web's two date fields
 * do: the first tap is the first day (and the last, for a single day), the
 * next is the last day. Nothing before `today` can be picked. A calendar
 * the app draws itself, so it is the same on a phone and on the web.
 */
export function DateRangePicker({
  today,
  weekStarts,
  value,
  onChange,
}: {
  today: string;
  weekStarts: IsoDow;
  value: DateRange;
  onChange: (range: DateRange, picking: boolean) => void;
}) {
  const { colors, type } = useTheme();
  const first = today.slice(0, 7);
  const [month, setMonth] = useState(value.from?.slice(0, 7) ?? first);
  const [picking, setPicking] = useState(false);
  const days = Array.from({ length: 7 }, (_, i) => DOW_LABEL[(((weekStarts - 1 + i) % 7) + 1) as IsoDow]);

  function tap(date: string) {
    if (picking && value.from && date >= value.from) {
      setPicking(false);
      onChange({ from: value.from, to: date }, false);
    } else {
      setPicking(true);
      onChange({ from: date, to: date }, true);
    }
  }

  return (
    <View style={styles.calendar} testID="date-range">
      <View style={styles.head}>
        <Button
          variant="ghost"
          icon={ChevronLeftIcon}
          label={AWAY_COPY.previousMonth}
          iconOnly
          disabled={month <= first}
          onPress={() => setMonth(shiftMonth(month, -1))}
        />
        <Text style={type.rowTitle} accessibilityLiveRegion="polite">
          {monthLabel(month)}
        </Text>
        <Button variant="ghost" icon={ChevronRightIcon} label={AWAY_COPY.nextMonth} iconOnly onPress={() => setMonth(shiftMonth(month, 1))} />
      </View>
      <View style={styles.week} aria-hidden>
        {days.map((d) => (
          <Text key={d} style={[type.sectionLabel, styles.dow]}>
            {d.slice(0, 1)}
          </Text>
        ))}
      </View>
      {monthGrid(month, weekStarts).map((week, w) => (
        <View key={w} style={styles.week}>
          {week.map((date, i) => {
            if (!date) return <View key={i} style={styles.cell} />;
            const past = date < today;
            const end = date === value.from || date === value.to;
            const inside = value.from !== null && value.to !== null && date > value.from && date < value.to;
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityLabel={spoken(date)}
                aria-selected={end || inside}
                aria-disabled={past}
                disabled={past}
                onPress={() => tap(date)}
                style={[
                  styles.cell,
                  styles.day,
                  end && { backgroundColor: colors.foreground },
                  inside && { backgroundColor: colors.secondary },
                  date === today && !end && { borderColor: colors.foreground, borderWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    type.body,
                    styles.date,
                    { color: end ? colors.background : past ? colors.mutedForeground : colors.foreground },
                    past && styles.past,
                  ]}
                >
                  {Number(date.slice(8))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  week: { flexDirection: 'row', gap: 2 },
  dow: { flex: 1, textAlign: 'center', paddingVertical: SPACE.xs },
  cell: { flex: 1, minHeight: TAP - 4 },
  day: { alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS },
  date: { fontFamily: FONT.bold },
  past: { opacity: 0.4 },
});
