"use client";

import {
  CATEGORIES,
  CATEGORY_LABEL,
  DOW_LABEL,
  JOHN_LIST_COPY,
  NEW_JOHN,
  pointsLabel,
  weeklyEffort,
  type Category,
  type IsoDow,
  type JohnDef,
} from "@app/core";
import { CameraIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { lidColor, LidSwatch } from "@/components/johns/lid";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";
import { archiveJohn, saveJohn } from "@/lib/actions/house";

export interface GroupOption {
  id: string;
  name: string;
}

/** The house's list of Johns. Changes land in next week's deal (or a re-deal). */
export function JohnList({
  johns,
  groups,
  editable,
}: {
  johns: JohnDef[];
  groups: GroupOption[];
  editable: boolean;
}) {
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name ?? null;
  const [editing, setEditing] = useState<(Omit<JohnDef, "id"> & { id?: string }) | null>(null);
  const total = weeklyEffort(johns);

  return (
    <div className="flex flex-col gap-3">
      {johns.length === 0 ? (
        <p className="rounded-md bg-secondary p-4 text-sm">{JOHN_LIST_COPY.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="john-list">
          {johns.map((j) => (
            <li
              key={j.id}
              className="flex items-center gap-3 rounded-md border border-l-[6px] border-border bg-background/40 py-2.5 pr-2 pl-3"
              style={{ borderLeftColor: lidColor(j.category) }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-bold">
                  {j.name}
                  {j.needsPhoto ? <CameraIcon className="size-3.5 text-muted-foreground" aria-label={JOHN_LIST_COPY.needsPhoto} /> : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {JOHN_LIST_COPY.when(j.everyWeeks, DOW_LABEL[j.dueDow], j.dueTime)}
                  {groupName(j.groupId) ? (
                    <>
                      {" · "}
                      <span className="font-bold text-foreground">{groupName(j.groupId)}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <span className="text-sm font-black tabular">{pointsLabel(j.points)}</span>
              {editable ? (
                <Button variant="ghost" size="icon-lg" aria-label={JOHN_LIST_COPY.edit(j.name)} onClick={() => setEditing(j)}>
                  <PencilIcon aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground tabular">{JOHN_LIST_COPY.perWeek(total)}</p>
      {editable ? (
        <Button variant="outline" className="self-start" onClick={() => setEditing({ ...NEW_JOHN })} data-testid="add-john">
          <PlusIcon aria-hidden />
          {JOHN_LIST_COPY.add}
        </Button>
      ) : null}
      <JohnEditor value={editing} groups={groups} onClose={() => setEditing(null)} />
    </div>
  );
}

function JohnEditor({
  value,
  groups,
  onClose,
}: {
  value: (Omit<JohnDef, "id"> & { id?: string }) | null;
  groups: GroupOption[];
  onClose: () => void;
}) {
  return (
    <Sheet open={value !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{value?.id ? JOHN_LIST_COPY.edit(value.name) : JOHN_LIST_COPY.add}</SheetTitle>
          <SheetDescription>{JOHN_LIST_COPY.hint}</SheetDescription>
        </SheetHeader>
        {value ? <JohnForm key={value.id ?? "new"} initial={value} groups={groups} onDone={onClose} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function JohnForm({
  initial,
  groups,
  onDone,
}: {
  initial: Omit<JohnDef, "id"> & { id?: string };
  groups: GroupOption[];
  onDone: () => void;
}) {
  const { pending, run } = useAction();
  const [v, setV] = useState(initial);
  const set = (patch: Partial<typeof v>) => setV((old) => ({ ...old, ...patch }));

  return (
    <form
      className="flex flex-col gap-4 px-4 pb-6"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveJohn(v), onDone);
      }}
    >
      <div>
        <FieldLabel htmlFor="john-name">{JOHN_LIST_COPY.name}</FieldLabel>
        <Input
          id="john-name"
          value={v.name}
          maxLength={60}
          required
          placeholder={JOHN_LIST_COPY.namePlaceholder}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>
      <div>
        <FieldLabel htmlFor="john-category">{JOHN_LIST_COPY.kind}</FieldLabel>
        <NativeSelect id="john-category" value={v.category} onChange={(e) => set({ category: e.target.value as Category })}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </NativeSelect>
        <LidSwatch category={v.category} className="mt-2 text-xs text-muted-foreground" />
      </div>
      <div>
        <FieldLabel htmlFor="john-group">{JOHN_LIST_COPY.sharedBy}</FieldLabel>
        <NativeSelect
          id="john-group"
          value={v.groupId ?? ""}
          onChange={(e) => set({ groupId: e.target.value || null })}
        >
          <option value="">{JOHN_LIST_COPY.everyone}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </NativeSelect>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {groups.length === 0 ? JOHN_LIST_COPY.noGroups : JOHN_LIST_COPY.groupOnly}
        </p>
      </div>
      <div>
        <FieldLabel>{JOHN_LIST_COPY.effort}</FieldLabel>
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={JOHN_LIST_COPY.effortPoints}>
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
          <FieldLabel htmlFor="john-every">{JOHN_LIST_COPY.often}</FieldLabel>
          <NativeSelect id="john-every" value={v.everyWeeks} onChange={(e) => set({ everyWeeks: Number(e.target.value) })}>
            {Object.entries(JOHN_LIST_COPY.every).map(([n, label]) => (
              <option key={n} value={n}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <FieldLabel htmlFor="john-day">{JOHN_LIST_COPY.due}</FieldLabel>
          <NativeSelect id="john-day" value={v.dueDow} onChange={(e) => set({ dueDow: Number(e.target.value) as IsoDow })}>
            {(Object.entries(DOW_LABEL) as [string, string][]).map(([d, label]) => (
              <option key={d} value={d}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div>
        <FieldLabel htmlFor="john-time">{JOHN_LIST_COPY.by}</FieldLabel>
        <Input id="john-time" type="time" value={v.dueTime} required onChange={(e) => set({ dueTime: e.target.value })} />
      </div>
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>
          <span className="block font-bold">{JOHN_LIST_COPY.photo}</span>
          <span className="text-sm text-muted-foreground">{JOHN_LIST_COPY.photoHint}</span>
        </span>
        <Switch checked={v.needsPhoto} onCheckedChange={(on) => set({ needsPhoto: on })} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? JOHN_LIST_COPY.saving : v.id ? JOHN_LIST_COPY.save : JOHN_LIST_COPY.create}
        </Button>
        {v.id ? (
          <Button type="button" variant="destructive" disabled={pending} onClick={() => run(() => archiveJohn(v.id!), onDone)}>
            {JOHN_LIST_COPY.remove}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
