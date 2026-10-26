import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body } from '@/components/text';
import { FONT, RADIUS, SPACE, TAP, useTheme } from '@/theme';

/**
 * One of a few, labelled like a field: the label in Body Bold, then the
 * choices as Segmented draws them (a tinted track, the chosen part raised on
 * the card colour), but sharing the width equally, so seven days fit across a
 * phone's sign. A radio group named by its label; each part says its whole
 * name (`spoken`), and the chosen one is `aria-checked`.
 */
export function Pick<T extends string | number>({
  label,
  options,
  value,
  onChange,
  testID,
}: {
  label: string;
  options: readonly { value: T; label: string; spoken?: string }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.field}>
      <Body style={styles.label}>{label}</Body>
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
              accessibilityLabel={option.spoken ?? option.label}
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
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: SPACE.sm },
  label: { fontFamily: FONT.bold },
  track: { flexDirection: 'row', borderRadius: RADIUS },
  part: {
    flex: 1,
    minHeight: TAP,
    borderWidth: 3,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
