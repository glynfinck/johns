import { DOW_LABEL, type IsoDow } from '@app/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, RADIUS, TAP, useTheme } from '@/theme';

const DAYS: readonly IsoDow[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Pick any of the seven days, Monday first: a Segmented's tinted track
 * across the page, each day a thumb-tall part ("Mo") raised on the card
 * colour while it's picked. To a screen reader each day is a checkbox
 * saying the whole day ("Monday"), `aria-checked` while picked, in a group
 * that `label` names.
 */
export function DayChips({
  value,
  onChange,
  label,
  testID,
}: {
  value: readonly IsoDow[];
  onChange: (days: IsoDow[]) => void;
  label: string;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <View role="group" aria-label={label} testID={testID} style={[styles.track, { backgroundColor: colors.secondary }]}>
      {DAYS.map((day) => {
        const picked = value.includes(day);
        return (
          <Pressable
            key={day}
            accessibilityRole="checkbox"
            accessibilityLabel={DOW_LABEL[day]}
            aria-checked={picked}
            onPress={() => onChange(picked ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b))}
            style={[styles.part, { borderColor: colors.secondary }, picked && { backgroundColor: colors.card }]}
            testID={`${testID ?? 'day'}-${day}`}
          >
            <Text numberOfLines={1} style={[type.meta, picked ? { fontFamily: FONT.bold, color: colors.foreground } : null]}>
              {DOW_LABEL[day].slice(0, 2)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignSelf: 'stretch', borderRadius: RADIUS },
  // An equal share of the track, however narrow: still a thumb tall.
  part: { flex: 1, minHeight: TAP, borderWidth: 3, borderRadius: RADIUS, alignItems: 'center', justifyContent: 'center' },
});
