import { DISPUTE_COPY } from '@app/core';
import { FlagIcon, ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { castVote, raiseDispute } from '@/api/disputes';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Sheet } from '@/components/sheet';
import { useMove } from '@/hooks/use-move';
import { SPACE } from '@/theme';

/** Housemate check: say what's wrong with someone's tick, and the house votes. */
export function DisputeButton({
  houseId,
  assignmentId,
  john,
  owner,
}: {
  houseId: string;
  assignmentId: string;
  john: string;
  owner: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" icon={FlagIcon} label={DISPUTE_COPY.open} onPress={() => setOpen(true)} testID="dispute" />
      <Sheet visible={open} title={DISPUTE_COPY.title(john)} description={DISPUTE_COPY.body(owner)} onClose={() => setOpen(false)}>
        <DisputeForm houseId={houseId} assignmentId={assignmentId} onSent={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

/**
 * The dispute itself: what's wrong with the tick, and "Put it to the house".
 * In DisputeButton's sheet, or in place inside the John sheet (which never
 * opens a second sheet). `onSent` follows a dispute the house accepted.
 */
export function DisputeForm({
  houseId,
  assignmentId,
  onSent,
  autoFocus = true,
}: {
  houseId: string;
  assignmentId: string;
  onSent?: () => void;
  autoFocus?: boolean;
}) {
  const move = useMove(houseId);
  const [reason, setReason] = useState('');

  async function send() {
    if (await move.run(() => raiseDispute(assignmentId, reason))) {
      setReason('');
      onSent?.();
    }
  }

  return (
    <View style={styles.form}>
      <Field
        label={DISPUTE_COPY.label}
        placeholder={DISPUTE_COPY.placeholder}
        value={reason}
        onChangeText={setReason}
        maxLength={280}
        multiline
        autoFocus={autoFocus}
        testID="dispute-reason"
      />
      {move.problem ? <Alert message={move.problem} /> : null}
      <Button
        label={move.pending ? DISPUTE_COPY.sending : DISPUTE_COPY.send}
        disabled={move.pending || !reason.trim()}
        onPress={() => void send()}
        testID="send-dispute"
      />
    </View>
  );
}

/** The house's vote on a dispute: two equal outline buttons, your vote shown chosen, and you can change it while it's open. */
export function VoteButtons({ houseId, disputeId, myVote }: { houseId: string; disputeId: string; myVote: boolean | null }) {
  const move = useMove(houseId);
  return (
    <View style={styles.votes}>
      <View style={styles.row}>
        <View style={styles.half}>
          <Button
            variant="outline"
            chosen={myVote === false}
            icon={ThumbsUpIcon}
            label={DISPUTE_COPY.fine}
            disabled={move.pending}
            onPress={() => void move.run(() => castVote(disputeId, false))}
          />
        </View>
        <View style={styles.half}>
          <Button
            variant="outline"
            chosen={myVote === true}
            icon={ThumbsDownIcon}
            label={DISPUTE_COPY.notDone}
            disabled={move.pending}
            onPress={() => void move.run(() => castVote(disputeId, true))}
          />
        </View>
      </View>
      {move.problem ? <Alert message={move.problem} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: SPACE.md },
  votes: { gap: SPACE.sm },
  row: { flexDirection: 'row', gap: SPACE.sm },
  half: { flex: 1 },
});
