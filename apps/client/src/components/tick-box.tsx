import { withAlpha } from '@app/core';
import { CheckIcon, FlagIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { LEADING, TAP, useTheme } from '@/theme';

/**
 * Where a John's tick has got to: open, ticked and being checked, done,
 * disputed (the house is voting on the tick), or a tick on its way.
 */
export type TickState = 'open' | 'checking' | 'done' | 'disputed' | 'busy';

/** The box sits in the row's leading slot, a little inside it, as a plate sits on a post. */
const BOX = LEADING - 4;
/** The sign's corner and its thick border, at a tick's size (StreetPlate's, drawn small). */
const CORNER = 5;
const EDGE = 3;

/**
 * A John's tick, in a row's leading slot, drawn as a small square plate with
 * the sign's thick border: a muted border while it's open; a green border on
 * green at 40% with an ink tick while the house checks it; green with a light
 * tick once it's done (the one green in a row); a hazard border with a flag
 * while it's disputed. With `onPress` it is a 48pt checkbox (`aria-checked`
 * once ticked, `aria-busy` while a tick is on its way); without, a picture of
 * the state that `label` names. Never amber.
 */
export function TickBox({
  state,
  onPress,
  label,
  disabled = false,
  testID,
}: {
  state: TickState;
  onPress?: () => void;
  /** What it does or shows, spoken: "Mark Bins done", "Done", "Disputed". */
  label: string;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const ticked = state === 'checking' || state === 'done' || state === 'disputed';
  const look = {
    open: { fill: 'transparent', edge: colors.mutedForeground },
    busy: { fill: 'transparent', edge: colors.mutedForeground },
    checking: { fill: withAlpha(colors.good, 0.4), edge: colors.good },
    done: { fill: colors.good, edge: colors.good },
    disputed: { fill: 'transparent', edge: colors.hazard },
  }[state];

  const box = (
    <View testID="tick-box" style={[styles.box, { backgroundColor: look.fill, borderColor: look.edge }]}>
      {state === 'busy' ? (
        <ActivityIndicator size="small" color={colors.mutedForeground} />
      ) : state === 'disputed' ? (
        <FlagIcon size={16} color={colors.hazard} aria-hidden />
      ) : ticked ? (
        <CheckIcon size={18} strokeWidth={2.5} color={state === 'done' ? colors.card : colors.foreground} aria-hidden />
      ) : null}
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={label} testID={testID} style={styles.target}>
        {box}
      </View>
    );
  }
  const off = disabled || state === 'busy';
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      aria-checked={ticked}
      aria-busy={state === 'busy'}
      aria-disabled={off}
      disabled={off}
      onPress={onPress}
      testID={testID}
      style={StyleSheet.flatten([styles.target, disabled && styles.disabled])}
    >
      {box}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // A thumb-sized target around the box, overhanging the 32pt leading slot evenly.
  target: { width: TAP, height: TAP, margin: -(TAP - LEADING) / 2, alignItems: 'center', justifyContent: 'center' },
  box: { width: BOX, height: BOX, borderRadius: CORNER, borderWidth: EDGE, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
});
