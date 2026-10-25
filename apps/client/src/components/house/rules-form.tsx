import {
  AWAY_MAKEUP,
  CURRENCIES,
  CURRENCY_SYMBOL,
  DISPUTE_HOURS,
  DOW_LABEL,
  MAKEUP_LABEL,
  moneyInput,
  parseMoney,
  RULES_COPY,
  type Currency,
  type HouseRules,
  type IsoDow,
} from '@app/core';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { updateHouse } from '@/api/settings';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Choice } from '@/components/choice';
import { Field } from '@/components/field';
import { Body } from '@/components/text';
import { useMove } from '@/hooks/use-move';
import { deviceTimeZone } from '@/locale';
import { SPACE } from '@/theme';

const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: `${CURRENCY_SYMBOL[c]} ${c}` }));
const DAY_OPTIONS = (Object.entries(DOW_LABEL) as [string, string][]).map(([day, name]) => ({
  value: Number(day) as IsoDow,
  label: name.slice(0, 3),
  spoken: name,
}));
const DISPUTE_OPTIONS = DISPUTE_HOURS.map((h) => ({ value: h as number, label: RULES_COPY.disputeHours(h) }));
const MAKEUP_OPTIONS = AWAY_MAKEUP.map((n) => ({ value: n as number, label: MAKEUP_LABEL[n] }));

/** What the form starts from: the house's name, its rules and its make-up rate. */
export interface RulesValues {
  name: string;
  rules: HouseRules;
  awayMakeup: number;
}

/**
 * The house's rules, as the web's form. Admins edit; everyone else reads the
 * same form, unchangeable. Amounts are typed as money and saved in minor
 * units.
 */
export function RulesForm({
  houseId,
  values,
  editable,
  saved,
  onSaved,
}: {
  houseId: string;
  values: RulesValues;
  editable: boolean;
  /** Whether the last save landed. The screen keeps it: a save reads the house again, which starts the form afresh. */
  saved: boolean;
  onSaved: (saved: boolean) => void;
}) {
  const move = useMove(houseId);
  const phoneZone = deviceTimeZone();
  const narrow = useWindowDimensions().width < 480;
  const [v, setV] = useState({
    name: values.name,
    timezone: values.rules.timezone,
    currency: values.rules.currency,
    weekStarts: values.rules.weekStarts,
    disputeHours: values.rules.disputeHours,
    awayMakeup: values.awayMakeup,
    stake: moneyInput(values.rules.stakeMinor),
    late: moneyInput(values.rules.lateForfeitMinor),
    missed: moneyInput(values.rules.missedForfeitMinor),
  });
  const [problem, setProblem] = useState<string | null>(null);
  const set = (patch: Partial<typeof v>) => {
    onSaved(false);
    setV((old) => ({ ...old, ...patch }));
  };
  const symbol = CURRENCY_SYMBOL[v.currency];
  const locked = !editable || move.pending;
  const wrong = problem ?? move.problem;

  async function save() {
    const stakeMinor = parseMoney(v.stake);
    const lateForfeitMinor = parseMoney(v.late);
    const missedForfeitMinor = parseMoney(v.missed);
    if (stakeMinor === null || lateForfeitMinor === null || missedForfeitMinor === null) {
      setProblem(RULES_COPY.badAmount);
      return;
    }
    setProblem(null);
    const ok = await move.run(() =>
      updateHouse(houseId, {
        name: v.name,
        timezone: v.timezone,
        currency: v.currency,
        weekStarts: v.weekStarts,
        stakeMinor,
        lateForfeitMinor,
        missedForfeitMinor,
        disputeHours: v.disputeHours,
        awayMakeup: v.awayMakeup,
      }),
    );
    onSaved(ok);
  }

  const money = [
    { key: 'stake', label: RULES_COPY.stake(symbol), testID: 'house-stake' },
    { key: 'late', label: RULES_COPY.late(symbol), testID: 'house-late' },
    { key: 'missed', label: RULES_COPY.missed(symbol), testID: 'house-missed' },
  ] as const;

  return (
    <View style={styles.form}>
      <Field label={RULES_COPY.name} value={v.name} onChangeText={(name) => set({ name })} maxLength={60} editable={!locked} testID="rules-name" />
      <View style={styles.stackSm}>
        <Field
          label={RULES_COPY.timezone}
          value={v.timezone}
          onChangeText={(timezone) => set({ timezone })}
          autoCapitalize="none"
          autoCorrect={false}
          hint={RULES_COPY.timezoneHint}
          editable={!locked}
          testID="rules-timezone"
        />
        {editable && phoneZone !== v.timezone ? (
          <View style={styles.start}>
            <Button variant="ghost" label={RULES_COPY.phoneZone(phoneZone)} onPress={() => set({ timezone: phoneZone })} />
          </View>
        ) : null}
      </View>
      <Choice label={RULES_COPY.weekStarts} options={DAY_OPTIONS} value={v.weekStarts} onChange={(weekStarts) => set({ weekStarts })} disabled={locked} />
      <Choice
        label={RULES_COPY.currency}
        options={CURRENCY_OPTIONS}
        value={v.currency}
        onChange={(currency: Currency) => set({ currency })}
        disabled={locked}
      />
      <View style={[styles.amounts, narrow && styles.amountsNarrow]}>
        {money.map((m) => (
          <View key={m.key} style={!narrow && styles.third}>
            <Field
              label={m.label}
              value={v[m.key]}
              onChangeText={(text) => set({ [m.key]: text })}
              keyboardType="decimal-pad"
              editable={!locked}
              testID={m.testID}
            />
          </View>
        ))}
      </View>
      <Choice
        label={RULES_COPY.disputes}
        options={DISPUTE_OPTIONS}
        value={v.disputeHours}
        onChange={(disputeHours) => set({ disputeHours })}
        disabled={locked}
      />
      <View style={styles.stackSm}>
        <Choice label={RULES_COPY.away} options={MAKEUP_OPTIONS} value={v.awayMakeup} onChange={(awayMakeup) => set({ awayMakeup })} disabled={locked} />
        <Body muted style={styles.hint}>
          {`${RULES_COPY.awayNote} ${RULES_COPY.makeupHint[v.awayMakeup]}`}
        </Body>
      </View>
      {wrong ? <Alert message={wrong} /> : null}
      {editable ? (
        <View style={styles.saveRow}>
          <Button label={move.pending ? RULES_COPY.saving : RULES_COPY.save} disabled={move.pending} onPress={() => void save()} testID="save-rules" />
          <View accessibilityLiveRegion="polite">{saved ? <Body muted>{RULES_COPY.saved}</Body> : null}</View>
        </View>
      ) : (
        <Body muted style={styles.hint}>
          {RULES_COPY.adminsOnly}
        </Body>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: SPACE.lg },
  stackSm: { gap: SPACE.xs },
  start: { alignItems: 'flex-start' },
  amounts: { flexDirection: 'row', gap: SPACE.md },
  amountsNarrow: { flexDirection: 'column' },
  third: { flex: 1 },
  hint: { fontSize: 13, lineHeight: 18 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
});
