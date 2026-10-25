import { CURRENCIES, CURRENCY_SYMBOL, DOW_LABEL, NEW_HOUSE_COPY, type Currency, type IsoDow } from '@app/core';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createHouse } from '@/api/house';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Choice } from '@/components/choice';
import { Field } from '@/components/field';
import { Body, Eyebrow, Heading } from '@/components/text';
import { Wordmark } from '@/components/wordmark';
import { useMembership } from '@/hooks/use-membership';
import { deviceCurrency, deviceTimeZone } from '@/locale';
import { SPACE, useTheme } from '@/theme';

const CURRENCY_OPTIONS = CURRENCIES.map((currency) => ({
  value: currency,
  label: `${CURRENCY_SYMBOL[currency]} ${currency}`,
}));

const DAY_OPTIONS = (Object.entries(DOW_LABEL) as [string, string][]).map(([day, name]) => ({
  value: Number(day) as IsoDow,
  label: name.slice(0, 3),
  spoken: name,
}));

/**
 * Setting up a house, as the web's /house/new: its name, currency and first
 * day of the week, with the time zone and currency starting from this phone.
 * Once the house exists, the root layout's guard moves on to Today.
 */
export default function NewHouse() {
  const { colors } = useTheme();
  const { refresh } = useMembership();
  const [timezone] = useState(deviceTimeZone);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency>(deviceCurrency);
  const [weekStarts, setWeekStarts] = useState<IsoDow>(1);
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
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Wordmark />
        <View>
          <Heading>{NEW_HOUSE_COPY.heading}</Heading>
          <Body muted style={styles.intro}>
            {NEW_HOUSE_COPY.intro}
          </Body>
        </View>

        <Card style={styles.form}>
          <Field
            label={NEW_HOUSE_COPY.name}
            placeholder={NEW_HOUSE_COPY.namePlaceholder}
            value={name}
            onChangeText={setName}
            maxLength={60}
            autoFocus
            returnKeyType="done"
            testID="house-name"
          />
          <Choice label={NEW_HOUSE_COPY.currency} options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} />
          <Choice label={NEW_HOUSE_COPY.weekStarts} options={DAY_OPTIONS} value={weekStarts} onChange={setWeekStarts} />
          <View>
            <Eyebrow>{NEW_HOUSE_COPY.timezone}</Eyebrow>
            <Body style={styles.zone}>{timezone.replaceAll('_', ' ')}</Body>
            <Body muted style={styles.note}>
              {NEW_HOUSE_COPY.timezoneFromPhone}
            </Body>
          </View>
          {problem ? <Alert message={problem} /> : null}
          <Button
            label={busy ? NEW_HOUSE_COPY.busy : NEW_HOUSE_COPY.submit}
            onPress={() => void submit()}
            disabled={busy || !name.trim()}
            testID="create-house"
          />
        </Card>

        <Body muted>{NEW_HOUSE_COPY.joinInstead}</Body>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 512, alignSelf: 'center', padding: SPACE.xl, gap: SPACE.xl },
  intro: { marginTop: SPACE.sm },
  form: { gap: SPACE.xl },
  zone: { marginTop: SPACE.xs },
  note: { fontSize: 13, lineHeight: 18 },
});
