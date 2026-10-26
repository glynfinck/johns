import { HOUSE_LOWER_COPY, leaveCost } from '@app/core';
import { useQueryClient } from '@tanstack/react-query';
import { DoorOpenIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { removeMember } from '@/api/settings';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { Group } from '@/components/group';
import { Row } from '@/components/row';
import { Meta } from '@/components/text';
import { TextButton } from '@/components/text-button';
import { houseKey } from '@/hooks/keys';
import type { HouseView } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { useStake } from '@/hooks/use-stake';
import { INSET, SPACE, useTheme } from '@/theme';

/**
 * Leaving the house, alone at the foot of House in hazard words, and the
 * footer under it. Its confirm says what leaving costs in money, from the
 * Stake once it's read (your share so far of the month's forfeits, and any
 * settling up still open with you), then leaves; the house's screens close
 * behind you as the guard moves you on. Until the Stake is read it says so,
 * and if it can't be, it says that instead and asks again the next time.
 */
export function LeaveSection({ houseId, userId, view }: { houseId: string; userId: string; view: HouseView }) {
  const { colors } = useTheme();
  const client = useQueryClient();
  const { refresh } = useMembership();
  const stake = useStake(houseId, view.snapshot);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { house, members, rules } = view.snapshot;

  let cost: string = HOUSE_LOWER_COPY.costReading;
  if (stake.data) {
    cost = leaveCost({
      me: userId,
      month: stake.data.month,
      share: stake.data.projection.find((p) => p.userId === userId)?.received ?? 0,
      transfers: stake.data.transfers,
      members,
      currency: rules.currency,
    });
  } else if (stake.isError) {
    cost = HOUSE_LOWER_COPY.costUnread;
  }

  async function leave() {
    setBusy(true);
    setProblem(null);
    try {
      await removeMember(houseId, userId);
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
      return;
    }
    // Not a move to read the house again after: it isn't yours any more. The
    // guard takes you to starting or joining one.
    await refresh();
    client.removeQueries({ queryKey: houseKey(houseId) });
  }

  return (
    <View testID="leave-section" style={styles.stack}>
      <Group>
        <Row
          leading={<DoorOpenIcon size={24} color={colors.hazard} aria-hidden />}
          title={HOUSE_LOWER_COPY.leave(house.name)}
          tone="hazard"
          onPress={() => {
            setProblem(null);
            setAsking(true);
            if (stake.isError) void stake.refetch();
          }}
          testID="leave"
        />
      </Group>
      <View style={styles.footer}>
        <Meta>{HOUSE_LOWER_COPY.noMoney}</Meta>
        <TextButton label={HOUSE_LOWER_COPY.privacy} href="/privacy" chevron testID="to-privacy" />
      </View>
      <ConfirmSheet
        visible={asking}
        title={HOUSE_LOWER_COPY.leaveAsk(house.name)}
        body={cost}
        confirmLabel={HOUSE_LOWER_COPY.leaveConfirm}
        icon={DoorOpenIcon}
        busy={busy}
        problem={problem}
        onConfirm={() => void leave()}
        onClose={() => setAsking(false)}
        testID="leave-sheet"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  // The words on the leading edge; Privacy's own padding sets it off from them.
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingLeft: INSET },
});
