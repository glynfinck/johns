import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { ASIDE, COLUMNS_MIN, CONTENT_MAX, GUTTER, PAGE_MAX, RAIL, SECTION_GAP, useTheme, WIDE } from '@/theme';

const ContentWidth = createContext(CONTENT_MAX);
const TwoColumns = createContext(false);

/** How wide the screen's content may get, so its title bar lines up with it. */
export function useContentWidth(): number {
  return useContext(ContentWidth);
}

/** Whether this page is in two columns: one that spreads, on a page at least COLUMNS_MIN wide. */
export function useColumns(): boolean {
  return useContext(TwoColumns);
}

/**
 * A house screen's page: its title bar (`bar`, a TitleBar) fixed at the top,
 * then the content, which scrolls and pulls to refresh. The content keeps
 * to CONTENT_MAX, sits GUTTER in from the edges, and puts SECTION_GAP
 * between its children. A page that `spreads` (Today, Week, House) keeps to
 * PAGE_MAX instead once the page itself is COLUMNS_MIN wide, a laptop's
 * beside the rail, and its content lays itself out in Columns; its title bar
 * spreads with it. The page measures itself, so it goes back to one column
 * when something beside it (the chat with Jonz) takes the room. The title
 * bar keeps clear of the notch; the tabs keep clear of the home bar.
 */
export function Screen({
  children,
  bar,
  maxWidth = CONTENT_MAX,
  spreads = false,
  refreshing,
  onRefresh,
  testID,
}: {
  children: ReactNode;
  bar?: ReactNode;
  maxWidth?: number;
  spreads?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const windowWidth = useWindowDimensions().width;
  // Until the page has measured itself, the window less the rail.
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? (windowWidth >= WIDE ? windowWidth - RAIL : windowWidth);
  const two = spreads && width >= COLUMNS_MIN;
  const max = two ? PAGE_MAX : maxWidth;
  const onLayout = spreads ? (e: LayoutChangeEvent) => setMeasured(e.nativeEvent.layout.width) : undefined;
  return (
    <ContentWidth.Provider value={max}>
      <TwoColumns.Provider value={two}>
        <View testID={testID} onLayout={onLayout} style={[styles.screen, { backgroundColor: colors.background }]}>
          {bar}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.page, { maxWidth: max }]}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.foreground} />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        </View>
      </TwoColumns.Provider>
    </ContentWidth.Provider>
  );
}

/**
 * A page in two columns: what you act on in `main`, what you glance at in
 * `side` (ASIDE wide), each keeping SECTION_GAP between its sections. Only
 * for a page in two columns (useColumns); a page in one keeps its phone
 * order, which these two lists may not follow.
 */
export function Columns({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <View style={styles.columns} testID="columns">
      <ContentWidth.Provider value={CONTENT_MAX}>
        <View style={styles.main} testID="column-main">
          {main}
        </View>
      </ContentWidth.Provider>
      <ContentWidth.Provider value={ASIDE}>
        <View style={styles.side} testID="column-side">
          {side}
        </View>
      </ContentWidth.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  page: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
    paddingTop: GUTTER,
    paddingBottom: SECTION_GAP,
    gap: SECTION_GAP,
    flexGrow: 1,
  },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: SECTION_GAP },
  main: { flex: 1, minWidth: 0, gap: SECTION_GAP },
  side: { width: ASIDE, gap: SECTION_GAP },
});
