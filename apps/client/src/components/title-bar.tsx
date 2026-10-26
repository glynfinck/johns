import { FOCUS_SHELL_COPY } from '@app/core';
import { useRouter, type Href } from 'expo-router';
import { ChevronLeftIcon, EllipsisIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useContentWidth } from '@/components/screen';
import { Meta, Title } from '@/components/text';
import { FONT, GUTTER, INSET, SPACE, TAP, TITLE_BAR, useTheme } from '@/theme';

/**
 * The top of every house screen, in place of the old wordmark strip: the
 * screen's one Title (caps, one line) on the pavement with a hairline under
 * it, `sub` as a Meta line beneath (House: "4 housemates · £20 a month
 * each"), and one thing on the right: the date (a string is set as Meta), a
 * MoreButton, or nothing. 52 tall; 74 with a sub line, which brings its own
 * room above the Title and under the sub. A pushed page passes `back`, the page to
 * go to when there's no history (a link opened cold): a link-like "‹ House"
 * (`backLabel`, the place it goes back to) sits on its own line above the
 * Title, which stays on the leading edge. It keeps clear of the notch and
 * lines up with the content below it.
 */
export function TitleBar({
  title,
  sub,
  right,
  back,
  backLabel = FOCUS_SHELL_COPY.back,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  back?: Href;
  /** Where back goes, in words ("House"); "Back" when left out. */
  backLabel?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const maxWidth = useContentWidth();
  return (
    <View
      testID="title-bar"
      style={[styles.bar, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.border }]}
    >
      <View style={[styles.inner, { maxWidth }]}>
        {back != null ? <BackLink fallback={back} label={backLabel} /> : null}
        <View style={[styles.line, sub ? styles.withSub : null, back != null && styles.pushed]}>
          <View style={styles.words}>
            <Title numberOfLines={1} style={styles.title}>
              {title}
            </Title>
            {sub ? <Meta numberOfLines={1}>{sub}</Meta> : null}
          </View>
          {right == null ? null : typeof right === 'string' ? (
            <Meta numberOfLines={1} style={styles.date}>
              {right}
            </Meta>
          ) : (
            <View style={styles.right}>{right}</View>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * Back where you came from, or to `fallback` when there's nowhere to go back
 * to: a chevron and the place's name in Body Bold, the chevron hanging just
 * left of the leading edge. Spoken as "Back to House".
 */
function BackLink({ fallback, label }: { fallback: Href; label: string }) {
  const { colors, type } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === FOCUS_SHELL_COPY.back ? label : FOCUS_SHELL_COPY.backTo(label)}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      testID="back"
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
    >
      <ChevronLeftIcon size={20} color={colors.foreground} aria-hidden />
      <Text numberOfLines={1} style={[type.body, styles.backWords]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The title bar's "•••": opens the screen's ActionMenu. */
export function MoreButton({ onPress, testID = 'more' }: { onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={FOCUS_SHELL_COPY.more}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.icon, styles.more, pressed && styles.pressed]}
    >
      <EllipsisIcon size={24} color={colors.foreground} aria-hidden />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  inner: { width: '100%', alignSelf: 'center', paddingHorizontal: GUTTER + INSET },
  line: {
    minHeight: TITLE_BAR,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.xs,
  },
  // With a sub line: the kit's 10 above (the Title's own 4 comes on top) and 8 under it.
  withSub: { paddingTop: 10, paddingBottom: SPACE.sm },
  // Under a back link: no 52 of its own, and a little room under the Title.
  pushed: { minHeight: 0, paddingTop: 0, paddingBottom: SPACE.sm },
  words: { flex: 1, minWidth: 0 },
  // Overpass's caps sit high in their line, so the title comes down a little.
  title: { paddingTop: 4 },
  date: { flexShrink: 0 },
  right: { flexShrink: 0, marginVertical: -SPACE.xs },
  back: {
    alignSelf: 'flex-start',
    minHeight: TAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    // The chevron's own margin hangs it left of the leading edge.
    marginLeft: -SPACE.sm,
    paddingRight: SPACE.sm,
  },
  backWords: { fontFamily: FONT.bold },
  icon: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  // The dots' right edge lines up with the content's.
  more: { marginRight: -SPACE.md },
  pressed: { opacity: 0.6 },
});
