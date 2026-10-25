import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';

type Size = number | `${number}%`;

/**
 * Hazard tape: marks what is late or missed, the way a cone would. A strip of
 * amber and ink: along the top by default, or down a side with a narrow
 * `width` and a full `height`.
 */
export function HazardTape({ height = 8, width = '100%' }: { height?: Size; width?: Size }) {
  const { colors } = useTheme();
  const id = `hazard-${useId().replace(/:/g, '')}`;
  return (
    <View aria-hidden style={{ height, width }} testID="hazard-tape">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width={12} height={12} patternTransform="rotate(45)">
            <Rect x={0} y={0} width={6} height={12} fill={colors.hivis} />
            <Rect x={6} y={0} width={6} height={12} fill={colors.foreground} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
