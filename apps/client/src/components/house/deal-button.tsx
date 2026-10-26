import { DEAL_COPY } from '@app/core';
import { ShuffleIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { dealThisWeek } from '@/api/settings';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { useMove } from '@/hooks/use-move';
import { SPACE } from '@/theme';

/**
 * Deal this week's Johns, as the web's button does, with a refusal under
 * it. The first time, it is the moment the house begins: amber, the
 * screen's one; afterwards it re-deals a week nobody has ticked anything
 * in, in outline. `label` says it in the screen's own words ("Deal week 1",
 * "Deal this week") and `variant` overrides the colour (Today's setup
 * checklist keeps it outline until the steps before it have something).
 * It sits at its own width on the leading edge, or across its container
 * with `fill` (in a card). The server checks it's an admin asking.
 */
export function DealButton({
  houseId,
  started = false,
  label,
  variant,
  fill = false,
}: {
  houseId: string;
  /** The house has dealt before. */
  started?: boolean;
  label?: string;
  variant?: 'primary' | 'outline';
  fill?: boolean;
}) {
  const move = useMove(houseId);
  return (
    <View style={[styles.stack, !fill && styles.start]}>
      <Button
        variant={variant ?? (started ? 'outline' : 'primary')}
        icon={ShuffleIcon}
        label={move.pending ? DEAL_COPY.dealing : (label ?? (started ? DEAL_COPY.again : DEAL_COPY.first))}
        disabled={move.pending}
        onPress={() => void move.run(() => dealThisWeek(houseId))}
        testID="deal-week"
      />
      {move.problem ? <Alert message={move.problem} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.sm },
  start: { alignItems: 'flex-start' },
});
