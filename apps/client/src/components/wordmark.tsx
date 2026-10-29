import { APP_NAME, SIGN, SIGN_SMALL, SIGN_SMALL_BELOW, TILE_RADIUS, signParts } from '@app/core';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { FONT, useTheme } from '@/theme';

/**
 * The sign: the J in its road-sign frame on its amber tile, the app icon's
 * drawing (packages/core/src/mark.ts). Below 48 it draws the small-size
 * master, whose lines hold up at a tab's size.
 */
export function SignMark({ size = 32 }: { size?: number }) {
  const { colors } = useTheme();
  const { frame, j } = signParts(size < SIGN_SMALL_BELOW ? SIGN_SMALL : SIGN);
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <Rect width={512} height={512} rx={TILE_RADIUS} fill={colors.hivis} />
      <Rect
        x={frame.x}
        y={frame.y}
        width={frame.size}
        height={frame.size}
        rx={frame.radius}
        fill="none"
        stroke={colors.onHivis}
        strokeWidth={frame.stroke}
      />
      <Path d={j.d} transform={j.transform} fill="none" stroke={colors.onHivis} strokeWidth={j.stroke} strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * The lockup: the sign, then JONZ in Overpass Black in whatever ink
 * surrounds it. The name is text rather than artwork, so it is sharp at
 * every size and in both themes; `size` is the name's font size, and the
 * sign is a quarter again as tall.
 */
export function Wordmark({ size = 24 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={APP_NAME} style={[styles.lockup, { gap: size * 0.32 }]}>
      <SignMark size={Math.round(size * 1.25)} />
      <Text style={[styles.name, { color: colors.foreground, fontSize: size, lineHeight: size * 1.1, paddingTop: size * 0.12 }]}>
        {APP_NAME}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center' },
  name: { fontFamily: FONT.black, textTransform: 'uppercase', letterSpacing: 0.5 },
});
