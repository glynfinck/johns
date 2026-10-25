import { BIN_NIGHT, type BinNightScheme } from '@app/core';
// Each weight from its own path: the package's index pulls in all eighteen
// weights and italics, and the bundle would carry every one.
import { Overpass_400Regular } from '@expo-google-fonts/overpass/400Regular';
import { Overpass_500Medium } from '@expo-google-fonts/overpass/500Medium';
import { Overpass_600SemiBold } from '@expo-google-fonts/overpass/600SemiBold';
import { Overpass_700Bold } from '@expo-google-fonts/overpass/700Bold';
import { Overpass_800ExtraBold } from '@expo-google-fonts/overpass/800ExtraBold';
import { Overpass_900Black } from '@expo-google-fonts/overpass/900Black';
import { useColorScheme, type TextStyle } from 'react-native';

// Bin Night for React Native: the one theme file. Colours come from @app/core
// (the same values as the web's globals.css, kept equal by a test in apps/api);
// this file only turns them into React Native styles. Never hardcode a colour
// anywhere else in the app.

/**
 * Overpass in the weights the web uses. On iOS and Android each weight is its
 * own font family, so text names the family; `fontWeight` alone would fall
 * back to the system font.
 */
export const FONT = {
  regular: 'Overpass_400Regular',
  medium: 'Overpass_500Medium',
  semibold: 'Overpass_600SemiBold',
  bold: 'Overpass_700Bold',
  extrabold: 'Overpass_800ExtraBold',
  black: 'Overpass_900Black',
} as const;

/** The font files, keyed by family, for `useFonts`. */
export const FONT_FILES = {
  [FONT.regular]: Overpass_400Regular,
  [FONT.medium]: Overpass_500Medium,
  [FONT.semibold]: Overpass_600SemiBold,
  [FONT.bold]: Overpass_700Bold,
  [FONT.extrabold]: Overpass_800ExtraBold,
  [FONT.black]: Overpass_900Black,
};

/** Spacing in points, on the web's 4px grid. */
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** The smallest a control may be: the web's `min-h-12`, a thumb's width. */
export const TAP = 48;

export const RADIUS = BIN_NIGHT.radius;

/** Width from which the web layout spreads out (Tailwind's `lg`). */
export const WIDE = 1024;

export type SchemeName = 'light' | 'dark';

export interface Theme {
  scheme: SchemeName;
  colors: BinNightScheme;
  type: {
    /** Uppercase Overpass, council-sign heavy. `level` 1 is the page title. */
    heading: (level: 1 | 2 | 3) => TextStyle;
    /** Small uppercase label with sign spacing (the web's `eyebrow`). */
    eyebrow: TextStyle;
    body: TextStyle;
    muted: TextStyle;
  };
}

const HEADING_SIZE = { 1: 40, 2: 24, 3: 18 } as const;

/** The theme for a colour scheme. Anything but "dark" is daylight. */
export function themeFor(scheme: string | null | undefined): Theme {
  const name: SchemeName = scheme === 'dark' ? 'dark' : 'light';
  const colors = BIN_NIGHT[name];
  return {
    scheme: name,
    colors,
    type: {
      heading: (level) => ({
        fontFamily: level === 1 ? FONT.black : FONT.extrabold,
        fontSize: HEADING_SIZE[level],
        lineHeight: Math.round(HEADING_SIZE[level] * (level === 1 ? 0.95 : 1.15)),
        letterSpacing: level === 1 ? -0.5 : 0,
        textTransform: 'uppercase',
        color: colors.foreground,
      }),
      eyebrow: {
        fontFamily: FONT.extrabold,
        fontSize: 11,
        letterSpacing: 1.3,
        textTransform: 'uppercase',
        color: colors.mutedForeground,
      },
      body: { fontFamily: FONT.regular, fontSize: 16, lineHeight: 24, color: colors.foreground },
      muted: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
    },
  };
}

/** The theme for the system's colour scheme, as the web follows the system by default. */
export function useTheme(): Theme {
  return themeFor(useColorScheme());
}
