import { dateRange, DELETE_COPY, HOUSE_COPY, HOUSE_LOWER_COPY, LOOK_LABEL, LOOKS, ME_COPY, MOVING_COPY, prefsLine, STEADY_COPY } from '@app/core';
import { BellIcon, LogOutIcon, SlidersHorizontalIcon, SunMoonIcon, Trash2Icon, TruckIcon } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { signOut } from '@/api/auth';
import { renameMe } from '@/api/profile';
import { reminderSupport, remindersOn } from '@/api/push';
import { DeleteAccountForm } from '@/components/account/delete-account';
import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Reminders } from '@/components/house/reminders';
import { useHouseWorkspace } from '@/components/house/workspace';
import { PendingMeta } from '@/components/house-page/setup-section';
import { Row, RowIcon } from '@/components/row';
import { Section } from '@/components/section';
import { Segmented } from '@/components/segmented';
import { Sheet } from '@/components/sheet';
import { Meta } from '@/components/text';
import { useLook } from '@/hooks/look';
import type { HouseView } from '@/hooks/use-house';
import { useMove } from '@/hooks/use-move';
import { INSET, SECTION_GAP, SPACE, useTheme } from '@/theme';

const LOOK_OPTIONS = LOOKS.map((value) => ({ value, label: LOOK_LABEL[value] }));

/**
 * You: your name (a sheet to change it), reminders on this device (a sheet
 * holding their switch, where there are any to offer), your preferences in
 * this house (their own page; on a laptop it's in the list beside House
 * instead), the look in the row itself, and signing out. Reminders and the
 * look are this device's own. Then Leave: your moving-out date (its own
 * page) and Delete my account, in hazard (a sheet), with a line saying it's
 * on the web too.
 */
export function YouSection({ houseId, userId, view }: { houseId: string; userId: string; view: HouseView }) {
  const [look, setLook] = useLook();
  const { colors } = useTheme();
  const [sheet, setSheet] = useState<'name' | 'reminders' | 'delete' | null>(null);
  // Each opening of the name sheet starts from the name as it is.
  const [opened, setOpened] = useState(0);
  const reminders = useReminderState();
  const [signingOut, setSigningOut] = useState(false);
  const { listed } = useHouseWorkspace();

  if (!view.me) return null;
  const name = view.me.name;
  const movingOutOn = view.snapshot.members.find((m) => m.userId === userId)?.movingOutOn ?? null;

  async function out() {
    setSigningOut(true);
    try {
      await signOut();
    } catch (reason) {
      // The guard moves on once the session is gone; anything else, try again.
      console.warn('Sign out failed', reason);
      setSigningOut(false);
    }
  }

  return (
    <View testID="you-section" style={styles.sections}>
      <Section label={HOUSE_COPY.you}>
        <Row
          leading={<Avatar name={name} userId={userId} me />}
          title={HOUSE_LOWER_COPY.name}
          meta={name}
          onPress={() => {
            setOpened((n) => n + 1);
            setSheet('name');
          }}
          chevron
          testID="to-name"
        />
        {reminders.support === 'none' ? null : (
          <Row
            leading={<RowIcon icon={BellIcon} />}
            title={HOUSE_LOWER_COPY.reminders}
            meta={reminders.on === null ? <PendingMeta /> : reminders.on ? HOUSE_LOWER_COPY.on : HOUSE_LOWER_COPY.off}
            onPress={() => setSheet('reminders')}
            chevron
            testID="to-reminders"
          />
        )}
        {listed ? null : (
          <Row
            leading={<RowIcon icon={SlidersHorizontalIcon} />}
            title={STEADY_COPY.prefs}
            meta={prefsLine(view.me.prefs)}
            href="/house/prefs"
            chevron
            testID="to-prefs"
          />
        )}
        <Row
          leading={<RowIcon icon={SunMoonIcon} />}
          title={HOUSE_LOWER_COPY.look}
          trailing={<Segmented options={LOOK_OPTIONS} value={look} onChange={setLook} label={ME_COPY.look} testID="look" />}
        />
        <Row
          leading={<RowIcon icon={LogOutIcon} />}
          title={HOUSE_LOWER_COPY.signOut}
          onPress={() => void out()}
          disabled={signingOut}
          testID="sign-out"
        />
      </Section>

      <View style={styles.leave}>
        <Section label={DELETE_COPY.leave}>
          <Row
            leading={<RowIcon icon={TruckIcon} />}
            title={MOVING_COPY.row}
            meta={movingOutOn ? dateRange(movingOutOn, movingOutOn) : MOVING_COPY.notPlanned}
            href="/house/moving"
            chevron
            testID="to-moving"
          />
          <Row
            leading={<Trash2Icon size={24} color={colors.hazard} aria-hidden />}
            title={DELETE_COPY.row}
            tone="hazard"
            onPress={() => setSheet('delete')}
            testID="to-delete-account"
          />
        </Section>
        <Meta style={styles.elsewhere}>{DELETE_COPY.elsewhere}</Meta>
      </View>

      <NameSheet
        key={opened}
        visible={sheet === 'name'}
        houseId={houseId}
        userId={userId}
        name={name}
        onClose={() => setSheet(null)}
      />
      <Sheet
        visible={sheet === 'reminders'}
        title={HOUSE_LOWER_COPY.reminders}
        onClose={() => setSheet(null)}
        onDismissed={reminders.read}
        testID="reminders-sheet"
      >
        {/* The sheet's title says Reminders, so the control doesn't again. */}
        <Reminders userId={userId} labelled={false} />
      </Sheet>
      <Sheet visible={sheet === 'delete'} title={DELETE_COPY.title} onClose={() => setSheet(null)} testID="delete-sheet">
        <DeleteAccountForm onKeep={() => setSheet(null)} />
      </Sheet>
    </View>
  );
}

/** Whether this device offers reminders, and whether they're on now (null until asked). */
function useReminderState() {
  const support = reminderSupport();
  const [on, setOn] = useState<boolean | null>(support === 'ready' ? null : false);
  // Asked as You comes up, and again once the reminders sheet is put away.
  const read = useCallback(() => {
    if (support === 'ready') void remindersOn().then(setOn);
  }, [support]);
  useEffect(read, [read]);
  return { support, on, read };
}

/** Your name, changed in a sheet: the field, any refusal, and Save, the sheet's one amber button. */
function NameSheet({
  visible,
  houseId,
  userId,
  name,
  onClose,
}: {
  visible: boolean;
  houseId: string;
  userId: string;
  name: string;
  onClose: () => void;
}) {
  const move = useMove(houseId);
  const [value, setValue] = useState(name);

  const unchanged = value.trim() === name;

  async function save() {
    // The keyboard's return key comes here too, Save held or not.
    if (move.pending || unchanged) return;
    if (await move.run(() => renameMe(userId, value))) onClose();
  }

  return (
    <Sheet visible={visible} title={HOUSE_LOWER_COPY.rename} onClose={onClose} testID="name-sheet">
      <Field
        label={ME_COPY.name}
        value={value}
        onChangeText={setValue}
        maxLength={60}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => void save()}
        testID="my-name"
      />
      {move.problem ? <Alert message={move.problem} /> : null}
      <Button
        label={HOUSE_LOWER_COPY.save}
        disabled={move.pending || unchanged}
        onPress={() => void save()}
        testID="save-name"
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sections: { gap: SECTION_GAP },
  leave: { gap: SPACE.sm },
  elsewhere: { paddingLeft: INSET },
});
