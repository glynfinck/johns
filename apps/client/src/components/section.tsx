import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { CountBadge } from '@/components/badge';
import { Group } from '@/components/group';
import { Meta, SectionLabel } from '@/components/text';
import { INSET, LABEL_GAP, ROW_GAP, SPACE, TAP } from '@/theme';

/** How far a thumb-tall control in the label's line hangs above and below it, so the line stays 24 tall. */
const OVERHANG = -(TAP - 24) / 2;

/**
 * A section of a page: its header, then LABEL_GAP, then one Group of its
 * rows. The header is the label, with a count badge after it when there's a
 * count, and an optional right-hand item (Meta words, a TextButton, a
 * Segmented). Week's person header adds `leading` (a 24pt Avatar) before the
 * label and `tag` (a quiet Chip, "Swap ready") after it. Sections don't
 * space themselves: the Screen, or a flush Sheet, holding them puts
 * SECTION_GAP between its children.
 */
export function Section({
  label,
  count,
  leading,
  tag,
  right,
  children,
  testID,
}: {
  label: string;
  /** What waits, as a badge after the label ("Needs you", 1). Nothing at zero. */
  count?: number;
  /** Before the label: an Avatar of size 24 (Week's person header). */
  leading?: ReactNode;
  /** After the label (and its badge): a quiet Chip, such as "Swap ready". */
  tag?: ReactNode;
  /** A string is set as Meta. */
  right?: ReactNode;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID}>
      <View style={styles.header}>
        <View style={styles.label}>
          {leading}
          <SectionLabel
            numberOfLines={1}
            // The badge is silent: the heading says the count.
            accessibilityLabel={count ? `${label}, ${count}` : undefined}
            style={styles.words}
          >
            {label}
          </SectionLabel>
          {count ? <CountBadge count={count} /> : null}
          {tag}
        </View>
        {right == null ? null : typeof right === 'string' ? (
          <Meta numberOfLines={1} style={styles.meta}>
            {right}
          </Meta>
        ) : (
          <View style={styles.right}>{right}</View>
        )}
      </View>
      <Group>{children}</Group>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ROW_GAP,
    paddingHorizontal: INSET,
    marginBottom: LABEL_GAP,
  },
  label: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  // Overpass's caps sit high in their line, so the label comes down a little.
  words: { flexShrink: 1, paddingTop: 2 },
  // Meta on the right gives way before the label does.
  meta: { flexShrink: 1, textAlign: 'right' },
  right: { flexShrink: 0, marginVertical: OVERHANG },
});
