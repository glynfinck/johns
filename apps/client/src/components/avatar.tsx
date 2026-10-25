import { initials } from '@app/core';
import { StyleSheet, Text, View } from 'react-native';

import { FONT, RADIUS, useTheme } from '@/theme';

/**
 * A housemate's initials on a plate, as on the web: yours in hi-vis. Photos
 * are deliberately not shown; initials stay legible small, in both themes.
 */
export function Avatar({ name, me = false, size = 32 }: { name: string; me?: boolean; size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      aria-hidden
      style={[styles.plate, { width: size, height: size, backgroundColor: me ? colors.hivis : colors.secondary }]}
    >
      <Text style={[styles.letters, { color: me ? colors.onHivis : colors.secondaryForeground, fontSize: size * 0.34 }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { borderRadius: RADIUS, alignItems: 'center', justifyContent: 'center' },
  letters: { fontFamily: FONT.extrabold, letterSpacing: 0.5 },
});
