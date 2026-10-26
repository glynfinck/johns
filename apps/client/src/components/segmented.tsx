import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, RADIUS, SPACE, TAP, useTheme } from '@/theme';

/**
 * A small two- or three-way switch for how a section shows itself
 * (Week | Oct, Mine | Whole house, Day | Night | Auto): a tinted track with
 * the chosen part raised on the card colour. A radio group to a screen
 * reader, `label` naming it; the chosen part is `aria-checked`.
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  testID,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      testID={testID}
      style={[styles.track, { backgroundColor: colors.secondary }]}
    >
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            aria-checked={chosen}
            onPress={() => {
              if (!chosen) onChange(option.value);
            }}
            // The chosen part sits inset in the track: a border of the track's own colour.
            style={[styles.part, { borderColor: colors.secondary }, chosen && { backgroundColor: colors.card }]}
          >
            <Text
              numberOfLines={1}
              style={[type.meta, chosen ? { fontFamily: FONT.bold, color: colors.foreground } : null]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignSelf: 'flex-start', borderRadius: RADIUS },
  part: {
    minHeight: TAP,
    minWidth: TAP,
    paddingHorizontal: SPACE.md,
    borderWidth: 3,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
