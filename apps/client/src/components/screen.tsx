import { createContext, useContext, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { CONTENT_MAX, GUTTER, SECTION_GAP, useTheme } from '@/theme';

const ContentWidth = createContext(CONTENT_MAX);

/** How wide the screen's content may get, so its title bar lines up with it. */
export function useContentWidth(): number {
  return useContext(ContentWidth);
}

/**
 * A house screen's page: its title bar (`bar`, a TitleBar) fixed at the top,
 * then the content, which scrolls and pulls to refresh. The content keeps
 * to CONTENT_MAX on every tab, a laptop's included, sits GUTTER in from the
 * edges, and puts SECTION_GAP between its children. The title bar keeps
 * clear of the notch; the tabs keep clear of the home bar.
 */
export function Screen({
  children,
  bar,
  maxWidth = CONTENT_MAX,
  refreshing,
  onRefresh,
  testID,
}: {
  children: ReactNode;
  bar?: ReactNode;
  maxWidth?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <ContentWidth.Provider value={maxWidth}>
      <View testID={testID} style={[styles.screen, { backgroundColor: colors.background }]}>
        {bar}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.page, { maxWidth }]}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.foreground} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </View>
    </ContentWidth.Provider>
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
});
