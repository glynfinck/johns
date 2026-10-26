import { lidColour } from '@app/core';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * A John's kind, as Focus shows it: a 10pt dot of its lid colour, placed only
 * before the kind's name in a meta line (Row's `lid` puts it there).
 */
export function LidDot({ category }: { category: string }) {
  const { colors } = useTheme();
  return <View aria-hidden testID="lid-dot" style={[styles.dot, { backgroundColor: lidColour(colors, category) }]} />;
}

const styles = StyleSheet.create({
  dot: { width: 10, height: 10, borderRadius: 5 },
});
