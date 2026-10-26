import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { INSET, SECTION_GAP, SPACE } from '@/theme';

/**
 * The sheet's words and buttons, on the leading edge (the flush sheet sets
 * its content at the gutter), a little apart, buttons at full width.
 */
export function SheetLines({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View testID={testID} style={styles.lines}>
      {children}
    </View>
  );
}

/** A Section in the sheet, as on a page: SECTION_GAP above it. */
export function SheetSection({ children }: { children: ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

const styles = StyleSheet.create({
  lines: { paddingHorizontal: INSET, marginTop: SPACE.lg, gap: SPACE.sm },
  section: { marginTop: SECTION_GAP },
});
