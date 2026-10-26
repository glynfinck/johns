import { FRONT_DOOR_COPY } from '@app/core';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Meta } from '@/components/text';
import { FONT, ROW_GAP, TAP, useTheme } from '@/theme';

/**
 * A new house's defaults as one Meta line, truncating rather than wrapping,
 * with "Change" as its one trailing item (Body Bold, as a text button's
 * words). The whole line is one button a thumb tall that opens and closes
 * what it sums up (`aria-expanded`), saying "Done" while it's open; a screen
 * reader hears the whole line.
 */
export function DefaultsLine({ parts, open, onToggle }: { parts: readonly string[]; open: boolean; onToggle: () => void }) {
  const { colors, type } = useTheme();
  const [pressed, setPressed] = useState(false);
  const action = open ? FRONT_DOOR_COPY.done : FRONT_DOOR_COPY.change;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${action}: ${parts.join(', ')}`}
      accessibilityHint={FRONT_DOOR_COPY.changeSpoken}
      aria-expanded={open}
      onPress={onToggle}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID="change-defaults"
      style={[styles.line, pressed && styles.pressed]}
    >
      <Meta numberOfLines={1} style={styles.words} testID="house-defaults">
        {parts.join(' · ')}
      </Meta>
      <Text style={[type.body, styles.action, { color: colors.foreground }]}>{action}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: { minHeight: TAP, flexDirection: 'row', alignItems: 'center', gap: ROW_GAP },
  words: { flex: 1 },
  action: { fontFamily: FONT.bold },
  pressed: { opacity: 0.6 },
});
