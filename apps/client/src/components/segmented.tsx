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
 *
 * `quiet` is for a section's header, beside its label (the Table's
 * Week | Oct): no track, just the words, as the header's other right-hand
 * items (See all) are. The chosen one is Body Bold in ink with a short
 * rule under it; the others are Body in the muted colour. Each keeps a
 * thumb-tall target, and the last one's padding is pulled out so its words
 * end at the header's edge.
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  equal = false,
  quiet = false,
  testID,
}: {
  options: readonly { value: T; label: string; spoken?: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  equal?: boolean;
  quiet?: boolean;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const narrow = useWindowDimensions().width < NARROW;
  if (quiet) {
    return (
      <View accessibilityRole="radiogroup" accessibilityLabel={label} testID={testID} style={styles.quiet}>
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
              style={({ pressed }) => [styles.word, pressed && styles.pressed]}
            >
              <Text
                numberOfLines={1}
                style={[type.body, chosen ? { fontFamily: FONT.bold } : { color: colors.mutedForeground }]}
              >
                {option.label}
              </Text>
              <View style={[styles.rule, chosen && { backgroundColor: colors.foreground }]} />
            </Pressable>
          );
        })}
      </View>
    );
  }
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
  // The last word's padding reaches past the header's edge, as an end-aligned TextButton's does.
  quiet: { flexDirection: 'row', marginRight: -SPACE.sm },
  word: { minHeight: TAP, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACE.sm },
  // Under the chosen word; the others keep the room, so the words don't move as the choice does.
  rule: { alignSelf: 'stretch', height: 2, marginTop: 2, borderRadius: 1 },
  pressed: { opacity: 0.6 },
});
