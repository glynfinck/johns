import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body } from '@/components/text';
import { FONT, RADIUS, SPACE, TAP, useTheme } from '@/theme';

/**
 * Pick one of a few, as a row of chips: the native stand-in for the web's
 * select. Each chip says its full name to a screen reader.
 */
export function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string; spoken?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.field}>
      <Body style={[type.eyebrow, styles.label]}>{label}</Body>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.chips}>
        {options.map((option) => {
          const chosen = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityLabel={option.spoken ?? option.label}
              accessibilityState={{ checked: chosen }}
              onPress={() => onChange(option.value)}
              style={[
                styles.chip,
                chosen
                  ? { backgroundColor: colors.foreground, borderColor: colors.foreground }
                  : { backgroundColor: 'transparent', borderColor: colors.border },
              ]}
            >
              <Text style={[styles.chipText, { color: chosen ? colors.background : colors.foreground }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: SPACE.xs },
  label: { marginBottom: SPACE.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  chip: {
    minHeight: TAP,
    minWidth: TAP,
    paddingHorizontal: SPACE.md,
    borderWidth: 1,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: FONT.bold, fontSize: 15 },
});
