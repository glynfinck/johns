import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldLabel } from '@/components/field';
import { RADIUS, SPACE, TAP, useTheme } from '@/theme';

/**
 * Pick one of a few, as a row of chips: the native stand-in for the web's
 * select. Labelled as a Field is (Body Bold, sentence case), each chip's
 * words a button's (RowTitle), and each chip says its full name to a screen
 * reader. `disabled` shows the choice without letting it change (the house
 * rules, to a housemate who isn't an admin).
 */
export function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: readonly { value: T; label: string; spoken?: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.chips}>
        {options.map((option) => {
          const chosen = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityLabel={option.spoken ?? option.label}
              aria-checked={chosen}
              aria-disabled={disabled}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={[
                styles.chip,
                disabled && !chosen && styles.off,
                chosen
                  ? { backgroundColor: colors.foreground, borderColor: colors.foreground }
                  : { backgroundColor: 'transparent', borderColor: colors.border },
              ]}
            >
              <Text style={[type.rowTitle, { color: chosen ? colors.background : colors.foreground }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: SPACE.sm },
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
  off: { opacity: 0.5 },
});
