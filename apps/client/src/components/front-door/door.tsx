import { APP_NAME } from '@app/core';
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { HazardTape } from '@/components/hazard-tape';
import { Body, Heading, Meta } from '@/components/text';
import { Wordmark } from '@/components/wordmark';
import { GUTTER, INSET, SECTION_GAP, SPACE, TAP, useTheme, WIDE } from '@/theme';

/**
 * How wide a page with one form on it gets: sign-in, starting a house, an
 * invite. Wide enough on a laptop for a new house's defaults line in full.
 */
const FORM_MAX = 520;

/** The tape's height across the top of a Sign. */
const TAPE = 8;

/**
 * A page from before you have a house: the pavement, the boxed wordmark on
 * the leading edge (a link to the front door, except on it) with `right`
 * beside it, then the page, centred and capped at `maxWidth`, its parts
 * SPACE.xl apart; from WIDE the whole column sits in the middle of the
 * window. These are the brand pages: the wordmark, the tape and big caps
 * belong here and never inside the house.
 */
export function Door({
  children,
  right,
  home = false,
  maxWidth = FORM_MAX,
  testID,
}: {
  children: ReactNode;
  /** Beside the wordmark: the front door's "Sign in". */
  right?: ReactNode;
  /** This is the front door, so the wordmark links nowhere. */
  home?: boolean;
  maxWidth?: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  return (
    <SafeAreaView testID={testID} style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.page, width >= WIDE && styles.middle, { maxWidth }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.top}>
          {home ? (
            <Wordmark />
          ) : (
            <Link href="/" asChild>
              <Pressable accessibilityRole="link" accessibilityLabel={APP_NAME} style={styles.home}>
                <Wordmark />
              </Pressable>
            </Link>
          )}
          {right}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * The page's one card, signed like roadworks: amber and ink tape along its
 * top, then its content on the card colour, SPACE.xl apart. A door page has
 * at most one.
 */
export function Sign({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <Card style={styles.sign} testID={testID}>
      <View style={styles.tape}>
        <HazardTape height={TAPE} />
      </View>
      {children}
    </Card>
  );
}

/**
 * A sign's heading: the page's heading in the brand pages' big caps (as the
 * front door's; there is no title bar here), a sentence under it in muted
 * Body, and `above` it a Meta line ("You're invited").
 */
export function SignHeading({ title, body, above }: { title: string; body?: string; above?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.heading}>
      {above ? <Meta>{above}</Meta> : null}
      <Heading>{title}</Heading>
      {body ? <Body style={{ color: colors.mutedForeground }}>{body}</Body> : null}
    </View>
  );
}

/** Words on the page under a Sign, on the leading edge: the small print, a way out. */
export function DoorFoot({ children }: { children: ReactNode }) {
  return <View style={styles.foot}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: {
    flexGrow: 1,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.lg,
    paddingBottom: SECTION_GAP,
    gap: SPACE.xl,
  },
  middle: { justifyContent: 'center' },
  // The wordmark sits on the leading edge, where the sign's words start.
  top: {
    minHeight: TAP,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: INSET,
  },
  // The wordmark's link is a thumb tall, like every other control.
  home: { alignSelf: 'flex-start', minHeight: TAP, justifyContent: 'center' },
  sign: { paddingTop: TAPE + SPACE.xl, gap: SPACE.xl },
  tape: { position: 'absolute', top: 0, left: 0, right: 0 },
  heading: { gap: SPACE.sm },
  foot: { paddingHorizontal: INSET, alignItems: 'flex-start' },
});
