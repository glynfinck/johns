"use client";

import { PlaneIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { cancelAway, setAway } from "@/lib/actions/away";
import type { AwayPeriod } from "@/lib/away";
import { dateRange } from "@/lib/format";

/** Book time away for yourself. */
export function AwayForm({ today }: { today: string }) {
  const [pending, start] = useTransition();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");

  function book(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const result = await setAway({ from, to, note });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      const moved = result?.moved ?? 0;
      // The one consequence this screen can't show: Johns elsewhere moved.
      if (moved > 0) {
        toast.success(
          `${moved} of your Johns ${moved === 1 ? "falls" : "fall"} due while you're away, so ${moved === 1 ? "it's" : "they're"} now due before you go.`,
        );
      }
      setFrom("");
      setTo("");
      setNote("");
    });
  }

  return (
    <form onSubmit={book} className="grid gap-3 sm:grid-cols-2" data-testid="away-form">
      <div>
        <FieldLabel htmlFor="away-from">First day away</FieldLabel>
        <Input
          id="away-from"
          type="date"
          min={today}
          required
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            if (!to || to < e.target.value) setTo(e.target.value);
          }}
        />
      </div>
      <div>
        <FieldLabel htmlFor="away-to">Last day away</FieldLabel>
        <Input id="away-to" type="date" min={from || today} required value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel htmlFor="away-note">Where (optional)</FieldLabel>
        <Input id="away-note" maxLength={60} placeholder="Lisbon" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button type="submit" disabled={pending || !from || !to} className="sm:col-span-2 sm:justify-self-start">
        <PlaneIcon aria-hidden />
        {pending ? "Booking…" : "Book time away"}
      </Button>
    </form>
  );
}

/** Your own trips, with a way to cancel one or come back early. */
export function MyTrips({ periods, today }: { periods: AwayPeriod[]; today: string }) {
  if (periods.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {periods.map((p) => (
        <TripRow key={p.id} period={p} today={today} />
      ))}
    </ul>
  );
}

function TripRow({ period, today }: { period: AwayPeriod; today: string }) {
  const { pending, run } = useAction();
  const started = period.startsOn <= today;
  return (
    <li className="flex items-center gap-3 rounded-md border border-border py-2 pr-2 pl-3">
      <PlaneIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-bold tabular">{dateRange(period.startsOn, period.endsOn)}</div>
        {period.note ? <div className="text-xs text-muted-foreground">{period.note}</div> : null}
      </div>
      <Button variant="ghost" disabled={pending} onClick={() => run(() => cancelAway(period.id))}>
        {pending ? "…" : started ? "I'm back" : "Cancel"}
      </Button>
    </li>
  );
}
