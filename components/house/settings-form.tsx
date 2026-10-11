"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/hooks/use-action";
import { updateHouse } from "@/lib/actions/house";
import { MAKEUP_LABEL } from "@/lib/deal";
import { CURRENCIES, DOW_LABEL, type Currency, type IsoDow } from "@/lib/domain";
import { parseMoney } from "@/lib/money";

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

const MAKEUP_HINT: Record<number, string> = {
  100: "Their share still counts, so they do a little extra each week when they're back until it evens out.",
  50: "Half their share still counts and is made up when they're back; the rest falls to whoever is home.",
  0: "Their share falls to whoever is home, and there's nothing to make up.",
};

const SYMBOL: Record<Currency, string> = { GBP: "£", CAD: "$", USD: "$", EUR: "€" };

export function timeZones(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [];
  }
  return zones.includes(current) ? zones : [current, ...zones];
}

const toMoney = (minor: number) => (minor / 100).toFixed(minor % 100 ? 2 : 0);

/** The house's rules. Admins edit; everyone else reads the same form, disabled. */
export function SettingsForm({ values, editable }: { values: SettingsValues; editable: boolean }) {
  const { pending, run } = useAction();
  const [v, setV] = useState({
    ...values,
    stake: toMoney(values.stakeMinor),
    late: toMoney(values.lateForfeitMinor),
    missed: toMoney(values.missedForfeitMinor),
  });
  const set = (patch: Partial<typeof v>) => setV((old) => ({ ...old, ...patch }));
  const symbol = SYMBOL[v.currency];

  function save(e: React.FormEvent) {
    e.preventDefault();
    const stakeMinor = parseMoney(v.stake);
    const lateForfeitMinor = parseMoney(v.late);
    const missedForfeitMinor = parseMoney(v.missed);
    if (stakeMinor === null || lateForfeitMinor === null || missedForfeitMinor === null) {
      toast.error("Amounts are numbers like 20 or 2.50.");
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
      () => toast.success("Saved"),
    );
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <fieldset disabled={!editable || pending} className="contents">
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="house-name">House name</FieldLabel>
          <Input id="house-name" value={v.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="house-tz">Time zone</FieldLabel>
          <NativeSelect id="house-tz" value={v.timezone} onChange={(e) => set({ timezone: e.target.value })}>
            {timeZones(v.timezone).map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <FieldLabel htmlFor="house-week">Week starts</FieldLabel>
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
          <FieldLabel htmlFor="house-currency">Currency</FieldLabel>
          <NativeSelect id="house-currency" value={v.currency} onChange={(e) => set({ currency: e.target.value as Currency })}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {SYMBOL[c]} {c}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <FieldLabel htmlFor="house-stake">Monthly stake ({symbol})</FieldLabel>
          <Input id="house-stake" inputMode="decimal" value={v.stake} onChange={(e) => set({ stake: e.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="house-late">Late forfeit ({symbol})</FieldLabel>
          <Input id="house-late" inputMode="decimal" value={v.late} onChange={(e) => set({ late: e.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="house-missed">Missed forfeit ({symbol})</FieldLabel>
          <Input id="house-missed" inputMode="decimal" value={v.missed} onChange={(e) => set({ missed: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="house-dispute">Disputes can be raised for</FieldLabel>
          <NativeSelect
            id="house-dispute"
            value={v.disputeHours}
            onChange={(e) => set({ disputeHours: Number(e.target.value) })}
          >
            {[0, 6, 12, 24, 48, 72].map((h) => (
              <option key={h} value={h}>
                {h === 0 ? "No disputes (honour system)" : `${h} hours after a tick`}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="house-away">Time away is made up</FieldLabel>
          <NativeSelect id="house-away" value={v.awayMakeup} onChange={(e) => set({ awayMakeup: Number(e.target.value) })}>
            {[100, 50, 0].map((n) => (
              <option key={n} value={n}>
                {MAKEUP_LABEL[n]}
              </option>
            ))}
          </NativeSelect>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Nobody is handed a John due while they&rsquo;re away. {MAKEUP_HINT[v.awayMakeup]}
          </p>
        </div>
        {editable ? (
          <Button type="submit" className="sm:col-span-2 sm:justify-self-start">
            {pending ? "Saving…" : "Save house rules"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground sm:col-span-2">Only admins can change the house rules.</p>
        )}
      </fieldset>
    </form>
  );
}
