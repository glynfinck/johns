import { BIN_NIGHT, type BinNightScheme, type Look } from '@app/core';
// Each weight from its own path: the package's index pulls in all eighteen
// weights and italics, and the bundle would carry every one.
import { Overpass_500Medium } from '@expo-google-fonts/overpass/500Medium';
import { Overpass_600SemiBold } from '@expo-google-fonts/overpass/600SemiBold';
import { createContext, useContext } from 'react';
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

/**
 * The font files, keyed by family, for `useFonts`. The four weights Focus sets
 * are the app's own copies (assets/fonts), whose middle dot keeps its width so
 * " · " has a space on both sides; the README there says what changed. Medium
 * and SemiBold are the package's, for the older pieces that still name them.
 */
export const FONT_FILES = {
  [FONT.regular]: require('../assets/fonts/Overpass_400Regular.ttf'),
  [FONT.medium]: Overpass_500Medium,
  [FONT.semibold]: Overpass_600SemiBold,
  [FONT.bold]: require('../assets/fonts/Overpass_700Bold.ttf'),
  [FONT.extrabold]: require('../assets/fonts/Overpass_800ExtraBold.ttf'),
  [FONT.black]: require('../assets/fonts/Overpass_900Black.ttf'),
};

/** Spacing in points, on the web's 4px grid. */
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** The smallest a control may be: the web's `min-h-12`, a thumb's width. */
export const TAP = 48;

export const RADIUS = BIN_NIGHT.radius;

/** Width from which the web layout spreads out (Tailwind's `lg`): the rail instead of the tabs. */
export const WIDE = 1024;

// Focus's layout, in points. A group or card starts GUTTER in from the page's
// edge and its content INSET further in, so everything readable lines up on
// one leading edge (32 on a phone): titles, section labels, rows' leading
// slots, card content.

/** From the page's edge to a group or a card. */
export const GUTTER = 16;
/** From a group's or card's edge to what's in it. */
export const INSET = 16;
/** The title bar's height, under the top safe area. */
export const TITLE_BAR = 52;
/** The shortest row: one line. A row with a meta line comes out at about 64. */
export const ROW_MIN = 56;
/** A row's leading slot: a tick circle, an avatar or an icon. */
export const LEADING = 32;
/** From the leading slot to the row's words, and between a row's other parts. */
export const ROW_GAP = 12;
/** An inset group's corners, and the one card's. */
export const GROUP_RADIUS = 10;
/** The widest a screen's content gets, on every tab. */
export const CONTENT_MAX = 680;
/** Between one section and the next. */
export const SECTION_GAP = 32;
/** From a section's label to its group. */
export const LABEL_GAP = 8;

/** Figures that line up in columns: Focus sets every number this way. */
export const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

export type SchemeName = 'light' | 'dark';

export interface Theme {
  scheme: SchemeName;
  colors: BinNightScheme;
  type: {
    // Focus's six roles (and the tab label and initials). A screen uses these and never
    // sets a size of its own. Copy is written in sentence case; the caps
    // come from the role.

    /** 28/32 Black caps: once per screen, in the title bar. */
    title: TextStyle;
    /** 22/28 Bold, sentence case: at most once per screen (the next John, "You're up £4.01"). */
    lead: TextStyle;
    /** 12 ExtraBold caps, tracked, muted: a section's name, three words at most. Chips use it in ink or hazard. */
    sectionLabel: TextStyle;
    /** 17 Bold: a row's title, a button's label. */
    rowTitle: TextStyle;
    /** 16/24 Regular: sentences, and a row's trailing value. */
    body: TextStyle;
    /** 14/20 Regular, muted: every subtitle and secondary line. */
    meta: TextStyle;
    /** 12 Bold, sentence case: the tab bar's labels. Colour by state, so none here. */
    tabLabel: TextStyle;
    /** 12/16 ExtraBold caps, a little tracked: an avatar's initials and a count badge's figure. The plate colours it. */
    initials: TextStyle;

    // Bin Night's older roles, kept for the brand screens (the front door,
    // sign-in, joining) and for screens Focus hasn't rebuilt yet.

    /** Uppercase Overpass, council-sign heavy. `level` 1 is the page title. */
    heading: (level: 1 | 2 | 3) => TextStyle;
    /** Small uppercase label with sign spacing (the web's `eyebrow`). */
    eyebrow: TextStyle;
    /** The quieter grey, for running text (the same as `meta`). */
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
      title: {
        fontFamily: FONT.black,
        fontSize: 28,
        lineHeight: 32,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        color: colors.foreground,
        ...TABULAR,
      },
      lead: { fontFamily: FONT.bold, fontSize: 22, lineHeight: 28, color: colors.foreground, ...TABULAR },
      sectionLabel: {
        fontFamily: FONT.extrabold,
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: colors.mutedForeground,
        ...TABULAR,
      },
      rowTitle: { fontFamily: FONT.bold, fontSize: 17, lineHeight: 22, color: colors.foreground, ...TABULAR },
      body: { fontFamily: FONT.regular, fontSize: 16, lineHeight: 24, color: colors.foreground, ...TABULAR },
      meta: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 20, color: colors.mutedForeground, ...TABULAR },
      tabLabel: { fontFamily: FONT.bold, fontSize: 12, lineHeight: 16, ...TABULAR },
      initials: {
        fontFamily: FONT.extrabold,
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        ...TABULAR,
      },
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
      muted: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
    },
  };
}

/**
 * The look this device chose: day, night, or the system's (the default, as
 * on the web). LookProvider (hooks/look.tsx) holds it; without one, the
 * system decides.
 */
export const LookContext = createContext<Look>('system');

/** The theme for the look this device chose, the system's colour scheme by default. */
export function useTheme(): Theme {
  const system = useColorScheme();
  const look = useContext(LookContext);
  return themeFor(look === 'system' ? system : look);
}
