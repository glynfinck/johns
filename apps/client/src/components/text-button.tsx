import { Link, type Href } from 'expo-router';
import { ChevronRightIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import type { ButtonIcon } from '@/components/button';
import { FONT, SPACE, TAP, useTheme } from '@/theme';

/**
 * A quiet action or link with no fill: Undo, See all, Change dates ›, Leave
 * the house. Body Bold words on a thumb-tall target. `chevron` adds the ›
 * of a link onward; `tone="hazard"` is for a destructive one (on the card
 * colour only). `align` pulls the target's padding out on that side, so the
 * words line up with the edge they sit on (`end` as a row's trailing item,
 * `start` on a page line). As a row's trailing item, give it an
 * `accessibilityLabel` that names the row's John ("Undo Clean out the
 * fridge"), so several Undos on one screen can be told apart.
 */
export function TextButton({
  label,
  onPress,
  href,
  icon: Icon,
  chevron = false,
  tone = 'ink',
  align,
  disabled = false,
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress?: () => void;
  href?: Href;
  icon?: ButtonIcon;
  chevron?: boolean;
  tone?: 'ink' | 'hazard';
  align?: 'start' | 'end';
  disabled?: boolean;
  /** What a screen reader says, when the words alone are ambiguous: it should start with them. */
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const [pressed, setPressed] = useState(false);
  const ink = tone === 'hazard' ? colors.hazard : colors.foreground;
  const button = (
    <Pressable
      accessibilityRole={href != null ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={testID}
      // One flat object: Link's asChild spreads the style, dropping an array.
      style={StyleSheet.flatten([
        styles.button,
        align === 'start' && styles.start,
        align === 'end' && styles.end,
        { opacity: disabled ? 0.5 : pressed ? 0.6 : 1 },
      ])}
    >
      {Icon ? <Icon size={20} color={ink} aria-hidden /> : null}
      <Text numberOfLines={1} style={[type.body, styles.label, { color: ink }]}>
        {label}
      </Text>
      {chevron ? <ChevronRightIcon size={16} color={ink} aria-hidden /> : null}
    </Pressable>
  );
  return href != null ? (
    <Link href={href} asChild>
      {button}
    </Link>
  ) : (
    button
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TAP,
    flexShrink: 0,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.md,
  },
  start: { marginLeft: -SPACE.md },
  end: { marginRight: -SPACE.md, alignSelf: 'auto' },
  label: { fontFamily: FONT.bold },
});
