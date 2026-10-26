import { NEXT_UP_COPY, NOT_DEALT_COPY, WEEK_SUMMARY_COPY } from '@app/core';
import { CalendarDaysIcon, ShuffleIcon } from 'lucide-react-native';

import { EmptyState } from '@/components/empty-state';
import { DealButton } from '@/components/house/deal-button';

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
  /** Who deals (core's whoDeals), for "Sam will deal it soon.", as Today says it. */
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
      body={isAdmin ? WEEK_SUMMARY_COPY.notDealtBody : NEXT_UP_COPY.waiting(adminName)}
      action={isAdmin ? <DealButton houseId={houseId} label={WEEK_SUMMARY_COPY.deal} /> : undefined}
      testID="week-not-dealt"
    />
  );
}
