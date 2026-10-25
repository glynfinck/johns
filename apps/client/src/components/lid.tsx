import { CATEGORY_LABEL, lidColour, type Category } from '@app/core';
import { StyleSheet, View } from 'react-native';

import { Body } from '@/components/text';
import { SPACE, useTheme } from '@/theme';

/** A John's bin lid: the strip of its kind's colour along the top of its card. */
export function Lid({ category, height = 4 }: { category: string; height?: number }) {
  const { colors } = useTheme();
  return <View aria-hidden testID="lid" style={{ height, backgroundColor: lidColour(colors, category) }} />;
}

/** A small square of lid colour with the kind's name, for legends and forms. */
export function LidSwatch({ category }: { category: Category }) {
  const { colors } = useTheme();
  return (
    <View style={styles.swatch}>
      <View aria-hidden style={[styles.square, { backgroundColor: lidColour(colors, category) }]} />
      <Body>{CATEGORY_LABEL[category]}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  swatch: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  square: { width: 12, height: 12, borderRadius: 2 },
});
