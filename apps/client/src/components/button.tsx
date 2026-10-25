import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { FONT, RADIUS, SPACE, TAP, useTheme } from '@/theme';

type Variant = 'primary' | 'outline' | 'ghost';

/**
 * A button at least a thumb tall. `primary` wears hi-vis amber: the one thing
 * to do on a screen.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  disabled = false,
  testID,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: LucideIcon;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const look = {
    primary: { background: colors.hivis, ink: colors.onHivis, edge: colors.hivis },
    outline: { background: 'transparent', ink: colors.foreground, edge: colors.border },
    ghost: { background: 'transparent', ink: colors.foreground, edge: 'transparent' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: look.background, borderColor: look.edge, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {Icon ? <Icon size={18} color={look.ink} aria-hidden /> : null}
      <Text style={[styles.label, { color: look.ink }]}>{label}</Text>
    </Pressable>
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
  label: { fontFamily: FONT.bold, fontSize: 16 },
});
