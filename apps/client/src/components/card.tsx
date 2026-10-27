import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { GROUP_RADIUS, INSET, useTheme } from '@/theme';

export { CardRows } from '@/components/group';

/**
 * The one stand-alone card a screen may have (Today's Next up, House's month
 * card): the card colour on the pavement, rounded like a group, no border.
 * A card never holds another card or a tinted panel. Rows go in it through
 * CardRows, which lines them up with the card's words and draws a hairline
 * above each.
 */
export function Card({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: colors.card }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: GROUP_RADIUS, padding: INSET, overflow: 'hidden' },
});
