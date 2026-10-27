import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Alert } from '@/components/alert';
import { Body, Meta } from '@/components/text';
import { FONT, RADIUS, SPACE, TAP, useTheme } from '@/theme';

/** A form control's label: Body Bold, sentence case. Field, Choice and a Segmented in a form use it. */
export function FieldLabel({ children }: { children: string }) {
  return <Body style={styles.label}>{children}</Body>;
}

/**
 * A labelled text box at least a thumb tall (a multiline one, a few lines
 * tall): the label in Body Bold and sentence case, the box on the card
 * colour, then a hint in Meta or a problem to fix (an Alert: ink, a
 * triangle, never hazard).
 */
export function Field({
  label,
  hint,
  problem,
  ...input
}: { label: string; hint?: string; problem?: string } & Omit<TextInputProps, 'style'>) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.mutedForeground}
        {...input}
        style={[
          styles.input,
          input.multiline && styles.multiline,
          // Body's face and size; a line height would set single-line text off centre on iOS.
          { fontFamily: type.body.fontFamily, fontSize: type.body.fontSize },
          {
            borderColor: problem ? colors.foreground : colors.mutedForeground,
            color: colors.foreground,
            backgroundColor: colors.card,
          },
        ]}
      />
      {problem ? <Alert message={problem} /> : hint ? <Meta>{hint}</Meta> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: SPACE.sm },
  label: { fontFamily: FONT.bold },
  input: {
    minHeight: TAP,
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingHorizontal: SPACE.md,
  },
  // Room for a few lines, written from the top, as far in from the edge above as from the sides.
  multiline: { minHeight: 96, paddingVertical: SPACE.md, textAlignVertical: 'top' },
});
