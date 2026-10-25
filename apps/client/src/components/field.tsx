import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Body } from '@/components/text';
import { FONT, RADIUS, SPACE, TAP, useTheme } from '@/theme';

/** A labelled text box at least a thumb tall, with an optional hint or problem under it. */
export function Field({
  label,
  hint,
  problem,
  ...input
}: { label: string; hint?: string; problem?: string } & Omit<TextInputProps, 'style'>) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.field}>
      <Body style={[type.eyebrow, styles.label]}>{label}</Body>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.mutedForeground}
        {...input}
        style={[
          styles.input,
          { borderColor: problem ? colors.hazard : colors.input, color: colors.foreground, backgroundColor: colors.background },
        ]}
      />
      {problem ? (
        <Body style={[styles.note, { color: colors.hazard }]}>{problem}</Body>
      ) : hint ? (
        <Body muted style={styles.note}>
          {hint}
        </Body>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: SPACE.xs },
  label: { marginBottom: SPACE.xs },
  input: {
    minHeight: TAP,
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingHorizontal: SPACE.md,
    fontFamily: FONT.regular,
    fontSize: 16,
  },
  note: { fontSize: 13, lineHeight: 18 },
});
