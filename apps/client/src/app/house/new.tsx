import {
  type Currency,
  CURRENCY_CHOICES,
  DAY_CHOICES,
  DOOR,
  FRONT_DOOR_COPY,
  houseDefaults,
  type IsoDow,
  MOVING_COPY,
  NEW_HOUSE_COPY,
  PAGE_TITLE,
  timeZoneName,
} from '@app/core';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createHouse } from '@/api/house';
import { startHouseFrom } from '@/api/moving';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Field, FieldLabel } from '@/components/field';
import { DefaultsLine } from '@/components/front-door/defaults-line';
import { Door, DoorFoot, Sign, SignHeading } from '@/components/front-door/door';
import { PageTitle } from '@/components/page-title';
import { Segmented } from '@/components/segmented';
import { Meta } from '@/components/text';
import { TextButton } from '@/components/text-button';
import { useMembership } from '@/hooks/use-membership';
import { useMovingOn } from '@/hooks/use-moving-on';
import { deviceCurrency, deviceTimeZone } from '@/locale';
import { SPACE } from '@/theme';

/**
 * Starting a house: one field, its name. The rest starts from this phone
 * (its time zone and currency) and Monday, said in one line under the name
 * with "Change" to open the currency and the first day of the week. Once the
 * house exists, the root layout's guard moves on to Today.
 *
 * From the Moving on screen (`?from=` the house you left) it's your new
 * place, and the old house's John list comes with it.
 */
export default function NewHouse() {
  const { refresh } = useMembership();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const moving = useMovingOn().data ?? null;
  const copying = moving && moving.fromHouse === from && moving.johns > 0 ? moving : null;
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
      const input = { name, timezone, currency, weekStarts };
      await (copying ? startHouseFrom(copying.fromHouse, input) : createHouse(input));
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
        {copying ? (
          <SignHeading title={MOVING_COPY.newHeading} body={MOVING_COPY.newIntro(copying.houseName, copying.johns)} />
        ) : (
          <SignHeading title={NEW_HOUSE_COPY.heading} body={NEW_HOUSE_COPY.intro} />
        )}
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
            <View style={styles.pick}>
              <FieldLabel>{NEW_HOUSE_COPY.currency}</FieldLabel>
              <Segmented
                equal
                label={NEW_HOUSE_COPY.currency}
                options={CURRENCY_CHOICES}
                value={currency}
                onChange={setCurrency}
                testID="house-currency"
              />
            </View>
            <View style={styles.pick}>
              <FieldLabel>{NEW_HOUSE_COPY.weekStarts}</FieldLabel>
              <Segmented
                equal
                label={NEW_HOUSE_COPY.weekStarts}
                options={DAY_CHOICES}
                value={weekStarts}
                onChange={setWeekStarts}
                testID="house-week-starts"
              />
            </View>
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
  // Labelled as a field is.
  pick: { gap: SPACE.sm },
});
