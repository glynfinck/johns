import { Link, type Href } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { FONT, RADIUS, SPACE, TAP, useTheme } from '@/theme';

type Variant = 'primary' | 'outline' | 'ghost';

/** A lucide icon, or anything drawn the same way (Google's mark). */
export type ButtonIcon = ComponentType<{ size?: number; color?: string; 'aria-hidden'?: boolean }>;

/**
 * A button at least a thumb tall. `primary` wears hi-vis amber: the one thing
 * to do on a screen. With `href` it is a link dressed as a button (an anchor
 * on the web), as the web app's are. `iconOnly` shows just the icon, square,
 * and `label` still names it for screen readers.
 */
export function Button({
  label,
  onPress,
  href,
  variant = 'primary',
  icon: Icon,
  disabled = false,
  iconOnly = false,
  testID,
}: {
  label: string;
  onPress?: () => void;
  href?: Href;
  variant?: Variant;
  icon?: ButtonIcon;
  disabled?: boolean;
  iconOnly?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const [pressed, setPressed] = useState(false);
  const look = {
    primary: { background: colors.hivis, ink: colors.onHivis, edge: colors.hivis },
    outline: { background: 'transparent', ink: colors.foreground, edge: colors.border },
    ghost: { background: 'transparent', ink: colors.foreground, edge: 'transparent' },
  }[variant];

  const button = (
    <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityState={{ disabled }}
      accessibilityLabel={iconOnly ? label : undefined}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={testID}
      // One flat object, not a function or an array: Link's asChild merges
      // styles by spreading them, which would drop either.
      style={StyleSheet.flatten([
        styles.button,
        iconOnly && styles.square,
        { backgroundColor: look.background, borderColor: look.edge, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ])}
    >
      {Icon ? <Icon size={18} color={look.ink} aria-hidden /> : null}
      {iconOnly ? null : <Text style={[styles.label, { color: look.ink }]}>{label}</Text>}
    </Pressable>
  );
  return href ? (
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
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
  },
  square: { minWidth: TAP, paddingHorizontal: SPACE.md },
  label: { fontFamily: FONT.bold, fontSize: 16 },
});
