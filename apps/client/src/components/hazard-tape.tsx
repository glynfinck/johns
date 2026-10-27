import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';

type Size = number | `${number}%`;

/** The tape's height across the top of a brand page's sign or the invite sheet. */
export const SIGN_TAPE = 8;

/**
 * Hazard tape: marks what is late or missed, the way a cone would. A strip of
 * amber and ink: along the top by default, or down a side with a narrow
 * `width` and a full `height`. Inside the house it is only ever a Row's 4pt
 * `hazardEdge`, in hazard and ink (`tone="hazard"`), because amber has only
 * two jobs there; the amber tape is for the brand screens.
 */
export function HazardTape({
  height = SIGN_TAPE,
  width = '100%',
  tone = 'hivis',
}: {
  height?: Size;
  width?: Size;
  tone?: 'hivis' | 'hazard';
}) {
  const { colors } = useTheme();
  const stripe = tone === 'hazard' ? colors.hazard : colors.hivis;
  const id = `hazard-${useId().replace(/:/g, '')}`;
  return (
    <View aria-hidden style={{ height, width }} testID="hazard-tape">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width={12} height={12} patternTransform="rotate(45)">
            <Rect x={0} y={0} width={6} height={12} fill={stripe} />
            <Rect x={6} y={0} width={6} height={12} fill={colors.foreground} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
