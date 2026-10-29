import Svg, { Path } from 'react-native-svg';

/** Microsoft's mark, its four squares in the button's own ink, as Google's is. */
export function MicrosoftIcon({ size = 18, color }: { size?: number; color?: string; 'aria-hidden'?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path fill={color} d="M3 3h8.5v8.5H3zM12.5 3H21v8.5h-8.5zM3 12.5h8.5V21H3zM12.5 12.5H21V21h-8.5z" />
    </Svg>
  );
}
