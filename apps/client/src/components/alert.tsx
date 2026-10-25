import { withAlpha } from '@app/core';
import { StyleSheet, Text, View } from 'react-native';

import { FONT, RADIUS, SPACE, useTheme } from '@/theme';

/** Something went wrong, said in hazard and announced as it appears. */
export function Alert({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.alert, { backgroundColor: withAlpha(colors.hazard, 0.1) }]}
    >
      <Text style={[styles.text, { color: colors.hazard }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  alert: { borderRadius: RADIUS, padding: SPACE.md },
  text: { fontFamily: FONT.bold, fontSize: 14, lineHeight: 20 },
});
