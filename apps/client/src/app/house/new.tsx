import {
  type Currency,
  CURRENCY_CHOICES,
  DAY_CHOICES,
  DOOR,
  FRONT_DOOR_COPY,
  houseDefaults,
  type IsoDow,
  NEW_HOUSE_COPY,
  PAGE_TITLE,
  timeZoneName,
} from '@app/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createHouse } from '@/api/house';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { DefaultsLine } from '@/components/front-door/defaults-line';
import { Door, DoorFoot, Sign, SignHeading } from '@/components/front-door/door';
import { Pick } from '@/components/front-door/pick';
import { PageTitle } from '@/components/page-title';
import { Meta } from '@/components/text';
import { TextButton } from '@/components/text-button';
import { useMembership } from '@/hooks/use-membership';
import { deviceCurrency, deviceTimeZone } from '@/locale';
import { SPACE } from '@/theme';

/**
 * Starting a house: one field, its name. The rest starts from this phone
 * (its time zone and currency) and Monday, said in one line under the name
 * with "Change" to open the currency and the first day of the week. Once the
 * house exists, the root layout's guard moves on to Today.
 */
export default function NewHouse() {
  const { refresh } = useMembership();
  const [timezone] = useState(deviceTimeZone);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency>(deviceCurrency);
  const [weekStarts, setWeekStarts] = useState<IsoDow>(1);
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setProblem(null);
    try {
      await createHouse({ name, timezone, currency, weekStarts });
      await refresh();
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  }

  return (
    <Door testID="new-house-screen">
      <PageTitle page={PAGE_TITLE.newHouse} />
      <Sign>
        <SignHeading title={NEW_HOUSE_COPY.heading} body={NEW_HOUSE_COPY.intro} />
        <View style={styles.name}>
          <Field
            label={FRONT_DOOR_COPY.name}
            placeholder={NEW_HOUSE_COPY.namePlaceholder}
            value={name}
            onChangeText={setName}
            onSubmitEditing={() => {
              if (name.trim() && !busy) void submit();
            }}
            maxLength={60}
            autoFocus
            returnKeyType="done"
            testID="house-name"
          />
          <DefaultsLine
            parts={houseDefaults({ currency, weekStarts, timezone })}
            open={changing}
            onToggle={() => setChanging((was) => !was)}
          />
        </View>
        {changing ? (
          <View style={styles.rest} testID="house-defaults-fields">
            <Pick label={NEW_HOUSE_COPY.currency} options={CURRENCY_CHOICES} value={currency} onChange={setCurrency} />
            <Pick label={NEW_HOUSE_COPY.weekStarts} options={DAY_CHOICES} value={weekStarts} onChange={setWeekStarts} />
            <Meta>{FRONT_DOOR_COPY.zoneNote(timeZoneName(timezone))}</Meta>
          </View>
        ) : null}
        {problem ? <Alert message={problem} /> : null}
        <Button
          label={busy ? NEW_HOUSE_COPY.busy : FRONT_DOOR_COPY.submit}
          onPress={() => void submit()}
          disabled={busy || !name.trim()}
          testID="create-house"
        />
      </Sign>
      <DoorFoot>
        <TextButton href={DOOR.invite} label={FRONT_DOOR_COPY.invite} chevron align="start" />
      </DoorFoot>
    </Door>
  );
}

const styles = StyleSheet.create({
  // The defaults read as the field's hint, right under it.
  name: { gap: SPACE.xs },
  rest: { gap: SPACE.xl },
});
