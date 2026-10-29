import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { FONT, NARROW, RADIUS, SPACE, TAP, useTheme } from '@/theme';

/**
 * A small two- or three-way switch for how a section shows itself
 * (Week | Oct, Mine | Whole house, Day | Night | Auto): a tinted track with
 * the chosen part raised on the card colour. A radio group to a screen
 * reader, `label` naming it; the chosen part is `aria-checked`, and each
 * says its `spoken` name where what it shows is short for one ("Mon" for
 * Monday). `equal` spreads it across its container, the parts sharing the
 * width, so seven days fit across a phone. On a small phone its parts
 * pad their words less, so the row beside it keeps its name ("Look").
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  equal = false,
  testID,
}: {
  options: readonly { value: T; label: string; spoken?: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  equal?: boolean;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const narrow = useWindowDimensions().width < NARROW;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      testID={testID}
      style={[styles.track, equal && styles.across, { backgroundColor: colors.secondary }]}
    >
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.spoken ?? option.label}
            aria-checked={chosen}
            onPress={() => {
              if (!chosen) onChange(option.value);
            }}
            // The chosen part sits inset in the track: a border of the track's own colour.
            style={[
              styles.part,
              narrow && styles.tight,
              equal && styles.share,
              { borderColor: colors.secondary },
              chosen && { backgroundColor: colors.card },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[type.meta, chosen ? { fontFamily: FONT.bold, color: colors.foreground } : null]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignSelf: 'flex-start', borderRadius: RADIUS },
  across: { alignSelf: 'stretch' },
  part: {
    minHeight: TAP,
    minWidth: TAP,
    paddingHorizontal: SPACE.md,
    borderWidth: 3,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tight: { paddingHorizontal: SPACE.xs },
  // An equal share of the track, however narrow: still a thumb tall.
  share: { flex: 1, minWidth: 0, paddingHorizontal: 0 },
});
