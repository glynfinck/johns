import { initials } from '@app/core';
import { StyleSheet, Text, View } from 'react-native';

import { useOnTint } from '@/components/row';
import { useTheme } from '@/theme';

/** Initials are never smaller than 12, so neither is a plate smaller than this. */
const SMALLEST = 24;

/**
 * A housemate's initials on a round plate: theirs on the neutral tint (on
 * the card colour where the row itself is tinted, so the plate still shows),
 * yours on an ink plate with light letters (never amber). Photos are deliberately
 * not shown; initials stay legible small, in both themes. 32 in a row's
 * leading slot, 24 in a header, and never smaller than 24.
 */
export function Avatar({ name, me = false, size: asked = 32 }: { name: string; me?: boolean; size?: number }) {
  const { colors, type } = useTheme();
  const onTint = useOnTint();
  const size = Math.max(asked, SMALLEST);
  return (
    <View
      aria-hidden
      testID={me ? 'avatar-me' : 'avatar'}
      style={[
        styles.plate,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: me ? colors.foreground : onTint ? colors.card : colors.secondary,
        },
      ]}
    >
      <Text style={[type.initials, styles.letters, { color: me ? colors.card : colors.secondaryForeground }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { alignItems: 'center', justifyContent: 'center' },
  // Overpass's caps sit high in their line, so the letters come down a little.
  letters: { paddingTop: 2 },
});
