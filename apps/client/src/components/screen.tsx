import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { SPACE, useTheme } from '@/theme';

/**
 * A house screen's page: it scrolls, pulls to refresh, and keeps to a
 * readable width on a laptop. The house's shell (tabs, header, sidebar)
 * already keeps clear of the notch and the home bar.
 */
export function Screen({
  children,
  maxWidth = 720,
  refreshing,
  onRefresh,
  testID,
}: {
  children: ReactNode;
  maxWidth?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      testID={testID}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.page, { maxWidth }]}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.foreground} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', alignSelf: 'center', padding: SPACE.xl, flexGrow: 1 },
});
