"use client";

import { CURRENCIES, CURRENCY_SYMBOL, DOW_LABEL, NEW_HOUSE_COPY, type Currency, type IsoDow } from "@app/core";
import { useState } from "react";

import { timeZones } from "@/components/house/settings-form";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/hooks/use-action";
import { createHouse } from "@/lib/actions/house";

export function CreateHouseForm({ timezone, currency }: { timezone: string; currency: Currency }) {
  const { pending, run } = useAction();
  const [name, setName] = useState("");
  const [tz, setTz] = useState(timezone);
  const [cur, setCur] = useState<Currency>(currency);
  const [weekStarts, setWeekStarts] = useState<IsoDow>(1);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createHouse({ name, timezone: tz, currency: cur, weekStarts }));
      }}
    >
      <div>
        <FieldLabel htmlFor="new-house-name">{NEW_HOUSE_COPY.name}</FieldLabel>
        <Input
          id="new-house-name"
          value={name}
          maxLength={60}
          required
          autoFocus
          placeholder={NEW_HOUSE_COPY.namePlaceholder}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="new-house-currency">{NEW_HOUSE_COPY.currency}</FieldLabel>
          <NativeSelect id="new-house-currency" value={cur} onChange={(e) => setCur(e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_SYMBOL[c]} {c}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <FieldLabel htmlFor="new-house-week">{NEW_HOUSE_COPY.weekStarts}</FieldLabel>
          <NativeSelect
            id="new-house-week"
            value={weekStarts}
            onChange={(e) => setWeekStarts(Number(e.target.value) as IsoDow)}
          >
            {(Object.entries(DOW_LABEL) as [string, string][]).map(([d, label]) => (
              <option key={d} value={d}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div>
        <FieldLabel htmlFor="new-house-tz">{NEW_HOUSE_COPY.timezone}</FieldLabel>
        <NativeSelect id="new-house-tz" value={tz} onChange={(e) => setTz(e.target.value)}>
          {timeZones(tz).map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit" disabled={pending || !name.trim()} data-testid="create-house">
        {pending ? NEW_HOUSE_COPY.busy : NEW_HOUSE_COPY.submit}
      </Button>
    </form>
  );
}
