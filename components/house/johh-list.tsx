"use client";

import { CameraIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { lidColor, LidSwatch } from "@/components/johhs/lid";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";
import { archiveJohh, saveJohh } from "@/lib/actions/house";
import { CATEGORIES, CATEGORY_LABEL, DOW_LABEL, type Category, type IsoDow } from "@/lib/domain";

export interface JohhDef {
  id: string;
  name: string;
  category: Category;
  points: number;
  everyWeeks: number;
  dueDow: IsoDow;
  dueTime: string;
  needsPhoto: boolean;
}

const BLANK: Omit<JohhDef, "id"> = {
  name: "",
  category: "kitchen",
  points: 2,
  everyWeeks: 1,
  dueDow: 7,
  dueTime: "21:00",
  needsPhoto: false,
};

const EVERY: Record<number, string> = { 1: "Every week", 2: "Every 2 weeks", 3: "Every 3 weeks", 4: "Every 4 weeks" };

/** The house's list of Johhs. Changes land in next week's rota (or a re-deal). */
export function JohhList({ johhs, editable }: { johhs: JohhDef[]; editable: boolean }) {
  const [editing, setEditing] = useState<(Omit<JohhDef, "id"> & { id?: string }) | null>(null);
  const total = johhs.reduce((s, j) => s + j.points / j.everyWeeks, 0);

  return (
    <div className="flex flex-col gap-3">
      {johhs.length === 0 ? (
        <p className="rounded-md bg-secondary p-4 text-sm">
          No Johhs yet. Start with the ones that cause arguments: bins, the bathroom, the kitchen.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="johh-list">
          {johhs.map((j) => (
            <li
              key={j.id}
              className="flex items-center gap-3 rounded-md border border-l-[6px] border-border bg-background/40 py-2.5 pr-2 pl-3"
              style={{ borderLeftColor: lidColor(j.category) }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-bold">
                  {j.name}
                  {j.needsPhoto ? <CameraIcon className="size-3.5 text-muted-foreground" aria-label="needs a photo" /> : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {EVERY[j.everyWeeks]} · due {DOW_LABEL[j.dueDow].slice(0, 3)} {j.dueTime}
                </div>
              </div>
              <span className="text-sm font-black tabular">{j.points} pts</span>
              {editable ? (
                <Button variant="ghost" size="icon-lg" aria-label={`Edit ${j.name}`} onClick={() => setEditing(j)}>
                  <PencilIcon aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground tabular">
        About {Math.round(total)} points a week across the house. Changes apply from the next deal.
      </p>
      {editable ? (
        <Button variant="outline" className="self-start" onClick={() => setEditing({ ...BLANK })} data-testid="add-johh">
          <PlusIcon aria-hidden />
          Add a Johh
        </Button>
      ) : null}
      <JohhEditor value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function JohhEditor({
  value,
  onClose,
}: {
  value: (Omit<JohhDef, "id"> & { id?: string }) | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={value !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{value?.id ? `Edit ${value.name}` : "Add a Johh"}</SheetTitle>
          <SheetDescription>Points are effort: 1 for taking the bins out, 5 for a deep clean.</SheetDescription>
        </SheetHeader>
        {value ? <JohhForm key={value.id ?? "new"} initial={value} onDone={onClose} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function JohhForm({ initial, onDone }: { initial: Omit<JohhDef, "id"> & { id?: string }; onDone: () => void }) {
  const { pending, run } = useAction();
  const [v, setV] = useState(initial);
  const set = (patch: Partial<typeof v>) => setV((old) => ({ ...old, ...patch }));

  return (
    <form
      className="flex flex-col gap-4 px-4 pb-6"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveJohh(v), onDone);
      }}
    >
      <div>
        <FieldLabel htmlFor="johh-name">Name</FieldLabel>
        <Input
          id="johh-name"
          value={v.name}
          maxLength={60}
          required
          placeholder="Bathroom clean"
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>
      <div>
        <FieldLabel htmlFor="johh-category">Kind</FieldLabel>
        <NativeSelect id="johh-category" value={v.category} onChange={(e) => set({ category: e.target.value as Category })}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </NativeSelect>
        <LidSwatch category={v.category} className="mt-2 text-xs text-muted-foreground" />
      </div>
      <div>
        <FieldLabel>Effort</FieldLabel>
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Effort points">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={v.points === p}
              onClick={() => set({ points: p })}
              className={`min-h-11 rounded-md border text-sm font-black tabular ${
                v.points === p ? "border-foreground bg-hivis text-on-hivis" : "border-border"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="johh-every">How often</FieldLabel>
          <NativeSelect id="johh-every" value={v.everyWeeks} onChange={(e) => set({ everyWeeks: Number(e.target.value) })}>
            {Object.entries(EVERY).map(([n, label]) => (
              <option key={n} value={n}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <FieldLabel htmlFor="johh-day">Due</FieldLabel>
          <NativeSelect id="johh-day" value={v.dueDow} onChange={(e) => set({ dueDow: Number(e.target.value) as IsoDow })}>
            {(Object.entries(DOW_LABEL) as [string, string][]).map(([d, label]) => (
              <option key={d} value={d}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div>
        <FieldLabel htmlFor="johh-time">By</FieldLabel>
        <Input id="johh-time" type="time" value={v.dueTime} required onChange={(e) => set({ dueTime: e.target.value })} />
      </div>
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>
          <span className="block font-bold">Needs a photo</span>
          <span className="text-sm text-muted-foreground">The tick only counts with a photo of the result.</span>
        </span>
        <Switch checked={v.needsPhoto} onCheckedChange={(on) => set({ needsPhoto: on })} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Saving…" : v.id ? "Save" : "Add Johh"}
        </Button>
        {v.id ? (
          <Button type="button" variant="destructive" disabled={pending} onClick={() => run(() => archiveJohh(v.id!), onDone)}>
            Remove
          </Button>
        ) : null}
      </div>
    </form>
  );
}
