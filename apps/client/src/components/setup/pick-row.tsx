import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Hairline, useRowInset } from '@/components/group';
import { ChoiceRow } from '@/components/setup/choice-row';
import { Body, RowTitle } from '@/components/text';
import { ROW_GAP, ROW_MIN, SPACE, TABULAR, useTheme } from '@/theme';

/** One choice a PickRow offers: its words in the list, and `short` for the row's value. */
export interface PickOption<T> {
  value: T;
  label: string;
  short?: string;
}

/**
 * A setting with a few values, as a row in a group: its name, what it's set
 * to, and a chevron. Pressed, it opens in place into the choices as radio
 * rows under it (a short select that never leaves the page or the sheet);
 * picking one closes it again. `aria-expanded` says whether it's open.
 */
export function PickRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  testID,
}: {
  label: string;
  options: readonly PickOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const inset = useRowInset();
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const chosen = options.find((o) => o.value === value);
  const shown = chosen?.short ?? chosen?.label ?? String(value);
  const Chevron = open ? ChevronUpIcon : ChevronDownIcon;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${shown}`}
        aria-expanded={open}
        aria-disabled={disabled}
        disabled={disabled}
        onPress={() => setOpen((was) => !was)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        testID={testID}
        style={[styles.row, { paddingHorizontal: inset }, pressed && { backgroundColor: colors.secondary }, disabled && styles.off]}
      >
        <Hairline />
        <RowTitle numberOfLines={1} style={styles.title}>
          {label}
        </RowTitle>
        <Body numberOfLines={1} style={styles.value}>
          {shown}
        </Body>
        <Chevron size={20} color={colors.mutedForeground} aria-hidden />
      </Pressable>
      {open ? (
        <View accessibilityRole="radiogroup" accessibilityLabel={label}>
          {options.map((option) => (
            <ChoiceRow
              key={String(option.value)}
              role="radio"
              label={option.label}
              checked={option.value === value}
              onPress={() => {
                setOpen(false);
                if (option.value !== value) onChange(option.value);
              }}
            />
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: ROW_MIN, flexDirection: 'row', alignItems: 'center', gap: ROW_GAP, paddingVertical: SPACE.sm },
  title: { flexShrink: 0, maxWidth: '55%' },
  value: { flex: 1, minWidth: 0, textAlign: 'right', ...TABULAR },
  off: { opacity: 0.5 },
});
