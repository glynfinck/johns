import { DEAL_COPY, NOT_DEALT_COPY, WEEK_SUMMARY_COPY } from '@app/core';
import { CalendarDaysIcon, ShuffleIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { dealThisWeek } from '@/api/settings';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { useMove } from '@/hooks/use-move';
import { SPACE } from '@/theme';

/**
 * Week with nothing on it. Before the house's first deal: "This week hasn't
 * been dealt yet", with the admin's amber "Deal this week" (the only amber
 * Week ever shows), or for everyone else who will deal it. After that, a
 * week with nothing handed out says why.
 */
export function WeekEmpty({
  houseId,
  notStarted,
  isAdmin,
  adminName,
}: {
  houseId: string;
  /** Nothing has ever been dealt in this house. */
  notStarted: boolean;
  isAdmin: boolean;
  /** An admin's first name, for "Sam will deal it soon." */
  adminName: string;
}) {
  if (!notStarted) {
    return (
      <EmptyState
        icon={CalendarDaysIcon}
        title={NOT_DEALT_COPY.nothingThisWeek}
        body={NOT_DEALT_COPY.nothingThisWeekBody}
        testID="week-empty"
      />
    );
  }
  return (
    <EmptyState
      icon={ShuffleIcon}
      title={WEEK_SUMMARY_COPY.notDealt}
      body={isAdmin ? WEEK_SUMMARY_COPY.notDealtBody : WEEK_SUMMARY_COPY.waitingFor(adminName)}
      action={isAdmin ? <FirstDeal houseId={houseId} /> : undefined}
      testID="week-not-dealt"
    />
  );
}

/**
 * The first deal, as House's deal button makes it, in Week's words. The
 * server checks it's an admin asking; a refusal shows under the button.
 */
function FirstDeal({ houseId }: { houseId: string }) {
  const move = useMove(houseId);
  return (
    <View style={styles.stack}>
      <Button
        icon={ShuffleIcon}
        label={move.pending ? DEAL_COPY.dealing : WEEK_SUMMARY_COPY.deal}
        disabled={move.pending}
        onPress={() => void move.run(() => dealThisWeek(houseId))}
        testID="deal-week"
      />
      {move.problem ? <Alert message={move.problem} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { alignItems: 'flex-start', gap: SPACE.sm },
});
