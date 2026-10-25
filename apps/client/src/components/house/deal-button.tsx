import { DEAL_COPY } from '@app/core';
import { ShuffleIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { dealThisWeek } from '@/api/settings';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { useMove } from '@/hooks/use-move';
import { SPACE } from '@/theme';

/**
 * Deal this week's Johns, as the web's button does. The first time, it is
 * the moment the house begins; afterwards it re-deals a week nobody has
 * ticked anything in. The server checks it's an admin asking.
 */
export function DealButton({ houseId, started }: { houseId: string; started: boolean }) {
  const move = useMove(houseId);
  return (
    <View style={styles.stack}>
      <View style={styles.start}>
        <Button
          variant={started ? 'outline' : 'primary'}
          icon={ShuffleIcon}
          label={move.pending ? DEAL_COPY.dealing : started ? DEAL_COPY.again : DEAL_COPY.first}
          disabled={move.pending}
          onPress={() => void move.run(() => dealThisWeek(houseId))}
          testID="deal-week"
        />
      </View>
      {move.problem ? <Alert message={move.problem} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.sm },
  start: { alignItems: 'flex-start' },
});
