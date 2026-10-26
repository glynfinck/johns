import { HOUSE_COPY, HOUSE_LOWER_COPY, LOOK_LABEL, LOOKS, ME_COPY } from '@app/core';
import { BellIcon, LogOutIcon, SunMoonIcon } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { signOut } from '@/api/auth';
import { renameMe } from '@/api/profile';
import { reminderSupport, remindersOn } from '@/api/push';
import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Reminders } from '@/components/house/reminders';
import { PendingMeta } from '@/components/house-page/setup-section';
import { Row, RowIcon } from '@/components/row';
import { Section } from '@/components/section';
import { Segmented } from '@/components/segmented';
import { Sheet } from '@/components/sheet';
import { useLook } from '@/hooks/look';
import type { HouseView } from '@/hooks/use-house';
import { useMove } from '@/hooks/use-move';

const LOOK_OPTIONS = LOOKS.map((value) => ({ value, label: LOOK_LABEL[value] }));

/**
 * You: your name (a sheet to change it), reminders on this device (a sheet
 * holding their switch, where there are any to offer), the look in the row
 * itself, and signing out. Reminders and the look are this device's own.
 */
export function YouSection({ houseId, userId, view }: { houseId: string; userId: string; view: HouseView }) {
  const [look, setLook] = useLook();
  const [sheet, setSheet] = useState<'name' | 'reminders' | null>(null);
  // Each opening of the name sheet starts from the name as it is.
  const [opened, setOpened] = useState(0);
  const reminders = useReminderState();
  const [signingOut, setSigningOut] = useState(false);

  if (!view.me) return null;
  const name = view.me.name;

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
    <View testID="you-section">
      <Section label={HOUSE_COPY.you}>
        <Row
          leading={<Avatar name={name} me />}
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

      <NameSheet
        key={opened}
        visible={sheet === 'name'}
        houseId={houseId}
        userId={userId}
        name={name}
        onClose={() => setSheet(null)}
      />
      {/* No title of its own: the reminders control heads itself. */}
      <Sheet
        visible={sheet === 'reminders'}
        onClose={() => setSheet(null)}
        onDismissed={reminders.read}
        testID="reminders-sheet"
      >
        <Reminders userId={userId} />
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
