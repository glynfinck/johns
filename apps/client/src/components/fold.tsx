import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Hairline, useRowInset } from '@/components/group';
import { FONT, LEADING, ROW_GAP, ROW_MIN, SPACE, useTheme } from '@/theme';

/**
 * Finished things, folded away inside a group: a row that says what it holds
 * ("Done (2)", from FOCUS_SHELL_COPY.done) and shows its rows under it when
 * opened. `meta` follows the label on the same line (" · 1 late", which the
 * caller may colour). `aria-expanded` says whether it's open.
 */
export function Fold({
  label,
  meta,
  children,
  initiallyOpen = false,
  testID,
}: {
  label: string;
  meta?: ReactNode;
  children: ReactNode;
  initiallyOpen?: boolean;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const inset = useRowInset();
  const [open, setOpen] = useState(initiallyOpen);
  const [pressed, setPressed] = useState(false);
  const Chevron = open ? ChevronUpIcon : ChevronDownIcon;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        aria-expanded={open}
        onPress={() => setOpen((was) => !was)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        testID={testID}
        style={[styles.fold, { paddingHorizontal: inset }, pressed && { backgroundColor: colors.secondary }]}
      >
        <Hairline />
        <View style={styles.leading}>
          <Chevron size={20} color={colors.mutedForeground} aria-hidden />
        </View>
        <Text numberOfLines={1} style={[type.body, styles.label]}>
          {label}
          {meta != null ? <Text>{' · '}</Text> : null}
          {meta}
        </Text>
      </Pressable>
      {open ? children : null}
    </>
  );
}

const styles = StyleSheet.create({
  fold: {
    minHeight: ROW_MIN,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
    paddingVertical: SPACE.sm,
  },
  leading: { width: LEADING, alignItems: 'center' },
  label: { flex: 1, fontFamily: FONT.bold },
});
