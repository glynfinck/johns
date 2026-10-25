import { APP_NAME } from '@app/core';
import { StyleSheet, Text, View } from 'react-native';

import { FONT, useTheme } from '@/theme';

/**
 * The mark: the name boxed like a road sign, in whatever ink surrounds it.
 * Text rather than artwork, so it is sharp at every size and in both themes.
 */
export function Wordmark({ size = 24 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={APP_NAME} style={[styles.sign, { borderColor: colors.foreground }]}>
      <Text style={[styles.name, { color: colors.foreground, fontSize: size, paddingHorizontal: size * 0.5 }]}>{APP_NAME}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sign: { alignSelf: 'flex-start', borderWidth: 3, borderRadius: 7 },
  name: { fontFamily: FONT.black, textTransform: 'uppercase', letterSpacing: 1.2, paddingTop: 6, paddingBottom: 2 },
});
