import { WEEK_SUMMARY_COPY } from '@app/core';
import { useRouter } from 'expo-router';
import { ListTodoIcon, PlaneIcon, ShuffleIcon } from 'lucide-react-native';
import { useState } from 'react';

import { dealThisWeek } from '@/api/settings';
import { ActionMenu, type MenuAction } from '@/components/action-menu';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { useToast } from '@/components/toast';
import { useMove } from '@/hooks/use-move';

/**
 * Week's "•••" menu: "I'm away…" (Time away) for everyone; for admins, "Edit
 * the John list" and, while nothing this week is ticked, "Re-deal this
 * week", which asks first, then deals the way the deal button does. The
 * server checks it's an admin asking and that nothing is ticked; a refusal
 * shows in the confirm.
 */
export function WeekMenu({
  visible,
  onClose,
  houseId,
  admin,
  canRedeal,
}: {
  visible: boolean;
  onClose: () => void;
  houseId: string;
  admin: boolean;
  /** This week is dealt and nothing in it has been ticked. */
  canRedeal: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const deal = useMove(houseId);
  const [confirming, setConfirming] = useState(false);
  // The last refusal belongs to the confirm it was made in, not the next one.
  const [asked, setAsked] = useState(false);

  const actions: MenuAction[] = [
    { label: WEEK_SUMMARY_COPY.awayAction, icon: PlaneIcon, onPress: () => router.push('/house/away'), testID: 'menu-away' },
  ];
  if (admin) {
    actions.push({ label: WEEK_SUMMARY_COPY.editJohns, icon: ListTodoIcon, onPress: () => router.push('/house/johns'), testID: 'menu-johns' });
    if (canRedeal) {
      actions.push({
        label: WEEK_SUMMARY_COPY.redeal,
        icon: ShuffleIcon,
        onPress: () => {
          setAsked(false);
          setConfirming(true);
        },
        testID: 'menu-redeal',
      });
    }
  }

  async function redeal() {
    setAsked(true);
    if (await deal.run(() => dealThisWeek(houseId))) {
      setConfirming(false);
      toast.show(WEEK_SUMMARY_COPY.redealt);
    }
  }

  return (
    <>
      <ActionMenu visible={visible} onClose={onClose} actions={actions} testID="week-menu" />
      <ConfirmSheet
        visible={confirming}
        title={WEEK_SUMMARY_COPY.redealTitle}
        body={WEEK_SUMMARY_COPY.redealBody}
        confirmLabel={WEEK_SUMMARY_COPY.redeal}
        icon={ShuffleIcon}
        tone="primary"
        busy={deal.pending}
        problem={asked ? deal.problem : null}
        onConfirm={() => void redeal()}
        onClose={() => setConfirming(false)}
        testID="redeal-confirm"
      />
    </>
  );
}
