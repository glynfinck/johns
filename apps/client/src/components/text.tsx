import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { useTheme } from '@/theme';

/** What every text role takes: the words, how many lines before they truncate, and a style to add. */
interface TextProps {
  children: ReactNode;
  /** Truncate with an ellipsis after this many lines (rows: 1). */
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

// The web's heading levels: react-native-web draws a header as an <h1>
// unless it is told the level, which React Native's types don't know.
const LEVEL_2 = { 'aria-level': 2 } as object;

// Focus's roles. Screens inside the house use only these.

/** The screen's one title: 28 Black caps, in the title bar. Announced as the page's heading. */
export function Title({ children, numberOfLines, style, testID }: TextProps) {
  const { type } = useTheme();
  return (
    <Text accessibilityRole="header" numberOfLines={numberOfLines} style={[type.title, style]} testID={testID}>
      {children}
    </Text>
  );
}

/**
 * The screen's one lead line, 22 Bold in sentence case: the next John's name,
 * "You're up £4.01". `header` announces it as a heading (a sheet's title).
 */
export function Lead({ children, numberOfLines, style, testID, header = false }: TextProps & { header?: boolean }) {
  const { type } = useTheme();
  return (
    <Text
      accessibilityRole={header ? 'header' : undefined}
      {...(header ? LEVEL_2 : {})}
      numberOfLines={numberOfLines}
      style={[type.lead, style]}
      testID={testID}
    >
      {children}
    </Text>
  );
}

/**
 * A section's name, 12 ExtraBold caps in muted ink: a heading, three words at
 * most. `accessibilityLabel` when the heading should say more than it shows
 * (Section's count).
 */
export function SectionLabel({
  children,
  numberOfLines,
  style,
  testID,
  accessibilityLabel,
}: TextProps & { accessibilityLabel?: string }) {
  const { type } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel}
      {...LEVEL_2}
      numberOfLines={numberOfLines}
      style={[type.sectionLabel, style]}
      testID={testID}
    >
      {children}
    </Text>
  );
}

/** A row's title, 17 Bold. */
export function RowTitle({ children, numberOfLines, style, testID }: TextProps) {
  const { type } = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[type.rowTitle, style]} testID={testID}>
      {children}
    </Text>
  );
}

/** Running text, 16 Regular; `muted` for the quieter grey (the old screens' small print). */
export function Body({ children, muted, numberOfLines, style, testID }: TextProps & { muted?: boolean }) {
  const { type } = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[muted ? type.muted : type.body, style]} testID={testID}>
      {children}
    </Text>
  );
}

/** A subtitle or secondary line, 14 Regular in muted ink. Segments go between " · ". */
export function Meta({ children, numberOfLines, style, testID }: TextProps) {
  const { type } = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[type.meta, style]} testID={testID}>
      {children}
    </Text>
  );
}

// Bin Night's older roles: the brand screens (front door, sign-in, joining)
// and the screens Focus hasn't rebuilt yet.

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
