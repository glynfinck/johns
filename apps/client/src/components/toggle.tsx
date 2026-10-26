import { StyleSheet, Switch, View } from 'react-native';

import { Body, Meta } from '@/components/text';
import { FONT, SPACE, TAP, useTheme } from '@/theme';

/** An on/off setting in words: what it is, a line on what it means (Meta), and the switch, inked when on (never amber). */
export function Toggle({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Body style={styles.label}>{label}</Body>
        {hint ? <Meta>{hint}</Meta> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.input, true: colors.foreground }}
        thumbColor={colors.card}
        // react-native-web draws its own thumb and track from these.
        {...({ activeThumbColor: colors.card } as object)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: TAP, flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  text: { flex: 1 },
  label: { fontFamily: FONT.bold },
});
