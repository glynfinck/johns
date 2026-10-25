import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { useTheme } from '@/theme';

/** A heading: uppercase Overpass, so screens never repeat the style. Level 1 is the page title. */
export function Heading({ level = 1, children, style }: { level?: 1 | 2 | 3; children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { type } = useTheme();
  return (
    <Text accessibilityRole="header" style={[type.heading(level), style]}>
      {children}
    </Text>
  );
}

/** Small uppercase label with council-sign spacing. */
export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { type } = useTheme();
  return <Text style={[type.eyebrow, style]}>{children}</Text>;
}

/** Running text; `muted` for the quieter grey. */
export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) {
  const { type } = useTheme();
  return <Text style={[muted ? type.muted : type.body, style]}>{children}</Text>;
}
