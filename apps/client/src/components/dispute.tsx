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
  const move = useMove(houseId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  async function send() {
    if (await move.run(() => raiseDispute(assignmentId, reason))) {
      setOpen(false);
      setReason('');
    }
  }

  return (
    <>
      <Button variant="ghost" icon={FlagIcon} label={DISPUTE_COPY.open} onPress={() => setOpen(true)} testID="dispute" />
      <Sheet visible={open} title={DISPUTE_COPY.title(john)} description={DISPUTE_COPY.body(owner)} onClose={() => setOpen(false)}>
        <Field
          label={DISPUTE_COPY.label}
          placeholder={DISPUTE_COPY.placeholder}
          value={reason}
          onChangeText={setReason}
          maxLength={280}
          multiline
          autoFocus
          testID="dispute-reason"
        />
        {move.problem ? <Alert message={move.problem} /> : null}
        <Button
          label={move.pending ? DISPUTE_COPY.sending : DISPUTE_COPY.send}
          disabled={move.pending || !reason.trim()}
          onPress={() => void send()}
          testID="send-dispute"
        />
      </Sheet>
    </>
  );
}

/** The house's vote on a dispute: your vote shows filled in, and you can change it while it's open. */
export function VoteButtons({ houseId, disputeId, myVote }: { houseId: string; disputeId: string; myVote: boolean | null }) {
  const move = useMove(houseId);
  return (
    <View style={styles.votes}>
      <View style={styles.row}>
        <View style={styles.half}>
          <Button
            variant={myVote === false ? 'primary' : 'outline'}
            icon={ThumbsUpIcon}
            label={DISPUTE_COPY.fine}
            disabled={move.pending}
            onPress={() => void move.run(() => castVote(disputeId, false))}
          />
        </View>
        <View style={styles.half}>
          <Button
            variant={myVote === true ? 'hazard' : 'outline'}
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
  votes: { gap: SPACE.sm },
  row: { flexDirection: 'row', gap: SPACE.sm },
  half: { flex: 1 },
});
