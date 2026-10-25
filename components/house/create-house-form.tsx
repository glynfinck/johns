"use client";

import { CURRENCIES, DOW_LABEL, type Currency, type IsoDow } from "@app/core";
import { useState } from "react";

import { timeZones } from "@/components/house/settings-form";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/hooks/use-action";
import { createHouse } from "@/lib/actions/house";

const SYMBOL: Record<Currency, string> = { GBP: "£", CAD: "$", USD: "$", EUR: "€" };

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
        <FieldLabel htmlFor="new-house-name">What do you call the house?</FieldLabel>
        <Input
          id="new-house-name"
          value={name}
          maxLength={60}
          required
          autoFocus
          placeholder="Flat 3"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="new-house-currency">Currency</FieldLabel>
          <NativeSelect id="new-house-currency" value={cur} onChange={(e) => setCur(e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {SYMBOL[c]} {c}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <FieldLabel htmlFor="new-house-week">The week starts on</FieldLabel>
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
        <FieldLabel htmlFor="new-house-tz">Time zone</FieldLabel>
        <NativeSelect id="new-house-tz" value={tz} onChange={(e) => setTz(e.target.value)}>
          {timeZones(tz).map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit" disabled={pending || !name.trim()} data-testid="create-house">
        {pending ? "Setting up…" : "Set up the house"}
      </Button>
    </form>
  );
}
