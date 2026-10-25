import { LOOK_LABEL, LOOKS, ME_COPY } from '@app/core';
import { useQueryClient } from '@tanstack/react-query';
import { LogOutIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { signOut } from '@/api/auth';
import { renameMe } from '@/api/profile';
import { removeMember } from '@/api/settings';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Choice } from '@/components/choice';
import { Field } from '@/components/field';
import { Reminders } from '@/components/house/reminders';
import { Body } from '@/components/text';
import { houseKey } from '@/hooks/keys';
import { useLook } from '@/hooks/look';
import { useMembership } from '@/hooks/use-membership';
import { useMove } from '@/hooks/use-move';
import { SPACE, useTheme } from '@/theme';

/**
 * You: your name, signing out, and leaving the house, as the web's card.
 * Leaving takes two taps, and then the house's screens close behind you.
 * Reminders and the look are this device's own.
 */
export function MeCard({
  houseId,
  userId,
  name,
  saved,
  onSaved,
}: {
  houseId: string;
  userId: string;
  name: string;
  /** Whether the rename landed. The screen keeps it: the new name starts the card afresh. */
  saved: boolean;
  onSaved: (saved: boolean) => void;
}) {
  const { colors } = useTheme();
  const client = useQueryClient();
  const { refresh } = useMembership();
  const move = useMove(houseId);
  const [value, setValue] = useState(name);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [look, setLook] = useLook();

  const wrong = move.problem ?? problem;

  async function rename() {
    onSaved(await move.run(() => renameMe(userId, value)));
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

  async function out() {
    setBusy(true);
    try {
      await signOut();
    } catch (reason) {
      // The guard moves on once the session is gone; anything else, try again.
      console.warn('Sign out failed', reason);
      setBusy(false);
    }
  }

  return (
    <View style={styles.stack}>
      <View style={styles.nameRow}>
        <View style={styles.grow}>
          <Field
            label={ME_COPY.name}
            value={value}
            onChangeText={(text) => {
              onSaved(false);
              setValue(text);
            }}
            maxLength={60}
            testID="my-name"
          />
        </View>
        <Button
          variant="outline"
          label={ME_COPY.save}
          disabled={move.pending || value.trim() === name}
          onPress={() => void rename()}
          testID="save-name"
        />
      </View>
      <View accessibilityLiveRegion="polite">{saved ? <Body muted>{ME_COPY.saved}</Body> : null}</View>
      {wrong ? <Alert message={wrong} /> : null}
      <Reminders userId={userId} />
      <Choice label={ME_COPY.look} options={LOOK_OPTIONS} value={look} onChange={setLook} />
      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <Button variant="outline" icon={LogOutIcon} label={ME_COPY.signOut} disabled={busy} onPress={() => void out()} testID="sign-out" />
        {leaving ? (
          <>
            <Button variant="hazard" label={ME_COPY.leaveForGood} disabled={busy} onPress={() => void leave()} testID="leave-house" />
            <Button variant="ghost" label={ME_COPY.stay} onPress={() => setLeaving(false)} />
          </>
        ) : (
          <Button variant="ghost" label={ME_COPY.leave} onPress={() => setLeaving(true)} />
        )}
      </View>
    </View>
  );
}

const LOOK_OPTIONS = LOOKS.map((value) => ({ value, label: LOOK_LABEL[value] }));

const styles = StyleSheet.create({
  stack: { gap: SPACE.md },
  nameRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.sm },
  grow: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACE.lg },
});
