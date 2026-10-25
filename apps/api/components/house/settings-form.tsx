"use client";

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
  type IsoDow,
} from "@app/core";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/hooks/use-action";
import { updateHouse } from "@/lib/actions/house";

export interface SettingsValues {
  name: string;
  timezone: string;
  currency: Currency;
  weekStarts: IsoDow;
  stakeMinor: number;
  lateForfeitMinor: number;
  missedForfeitMinor: number;
  disputeHours: number;
  awayMakeup: number;
}

export function timeZones(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [];
  }
  return zones.includes(current) ? zones : [current, ...zones];
}

/** The house's rules. Admins edit; everyone else reads the same form, disabled. */
export function SettingsForm({ values, editable }: { values: SettingsValues; editable: boolean }) {
  const { pending, run } = useAction();
  const [v, setV] = useState({
    ...values,
    stake: moneyInput(values.stakeMinor),
    late: moneyInput(values.lateForfeitMinor),
    missed: moneyInput(values.missedForfeitMinor),
  });
  const set = (patch: Partial<typeof v>) => setV((old) => ({ ...old, ...patch }));
  const symbol = CURRENCY_SYMBOL[v.currency];

  function save(e: React.FormEvent) {
    e.preventDefault();
    const stakeMinor = parseMoney(v.stake);
    const lateForfeitMinor = parseMoney(v.late);
    const missedForfeitMinor = parseMoney(v.missed);
    if (stakeMinor === null || lateForfeitMinor === null || missedForfeitMinor === null) {
      toast.error(RULES_COPY.badAmount);
      return;
    }
    run(
      () =>
        updateHouse({
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
      () => toast.success(RULES_COPY.saved),
    );
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <fieldset disabled={!editable || pending} className="contents">
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="house-name">{RULES_COPY.name}</FieldLabel>
          <Input id="house-name" value={v.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="house-tz">{RULES_COPY.timezone}</FieldLabel>
          <NativeSelect id="house-tz" value={v.timezone} onChange={(e) => set({ timezone: e.target.value })}>
            {timeZones(v.timezone).map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <FieldLabel htmlFor="house-week">{RULES_COPY.weekStarts}</FieldLabel>
          <NativeSelect
            id="house-week"
            value={v.weekStarts}
            onChange={(e) => set({ weekStarts: Number(e.target.value) as IsoDow })}
          >
            {(Object.entries(DOW_LABEL) as [string, string][]).map(([d, label]) => (
              <option key={d} value={d}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <FieldLabel htmlFor="house-currency">{RULES_COPY.currency}</FieldLabel>
          <NativeSelect id="house-currency" value={v.currency} onChange={(e) => set({ currency: e.target.value as Currency })}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_SYMBOL[c]} {c}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <FieldLabel htmlFor="house-stake">{RULES_COPY.stake(symbol)}</FieldLabel>
          <Input id="house-stake" inputMode="decimal" value={v.stake} onChange={(e) => set({ stake: e.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="house-late">{RULES_COPY.late(symbol)}</FieldLabel>
          <Input id="house-late" inputMode="decimal" value={v.late} onChange={(e) => set({ late: e.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="house-missed">{RULES_COPY.missed(symbol)}</FieldLabel>
          <Input id="house-missed" inputMode="decimal" value={v.missed} onChange={(e) => set({ missed: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="house-dispute">{RULES_COPY.disputes}</FieldLabel>
          <NativeSelect
            id="house-dispute"
            value={v.disputeHours}
            onChange={(e) => set({ disputeHours: Number(e.target.value) })}
          >
            {DISPUTE_HOURS.map((h) => (
              <option key={h} value={h}>
                {RULES_COPY.disputeHours(h)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="house-away">{RULES_COPY.away}</FieldLabel>
          <NativeSelect id="house-away" value={v.awayMakeup} onChange={(e) => set({ awayMakeup: Number(e.target.value) })}>
            {AWAY_MAKEUP.map((n) => (
              <option key={n} value={n}>
                {MAKEUP_LABEL[n]}
              </option>
            ))}
          </NativeSelect>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {RULES_COPY.awayNote} {RULES_COPY.makeupHint[v.awayMakeup]}
          </p>
        </div>
        {editable ? (
          <Button type="submit" className="sm:col-span-2 sm:justify-self-start">
            {pending ? RULES_COPY.saving : RULES_COPY.save}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground sm:col-span-2">{RULES_COPY.adminsOnly}</p>
        )}
      </fieldset>
    </form>
  );
}
