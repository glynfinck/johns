import { StyleSheet } from 'react-native';

import { Body } from '@/components/text';
import { TABULAR } from '@/theme';

/**
 * A read-out row's value, as its one trailing item ("Shared by · Upstairs
 * bathroom"): Body on one line, at most 60% of the row and cut short past
 * that, so a long group or place name never squeezes the label beside it.
 */
export function RowValue({ children }: { children: string }) {
  return (
    <Body numberOfLines={1} style={styles.value}>
      {children}
    </Body>
  );
}

const styles = StyleSheet.create({
  value: { flexShrink: 1, maxWidth: '60%', textAlign: 'right', ...TABULAR },
});
