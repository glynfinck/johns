"use client";

import { PencilIcon, PlusIcon, UsersIcon } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAction } from "@/hooks/use-action";
import { deleteGroup, saveGroup } from "@/lib/actions/house";
import { firstName } from "@/lib/format";

export interface GroupDef {
  id: string;
  name: string;
  memberIds: string[];
}

interface Person {
  userId: string;
  name: string;
}

/**
 * Groups: the parts of the house only some of you share. A John can belong
 * to one, and then only that group is handed it.
 */
export function GroupsList({
  groups,
  people,
  me,
  editable,
}: {
  groups: GroupDef[];
  people: Person[];
  me: string;
  editable: boolean;
}) {
  const [editing, setEditing] = useState<{ id?: string; name: string; memberIds: string[] } | null>(null);
  const nameOf = (id: string) => (id === me ? "You" : firstName(people.find((p) => p.userId === id)?.name ?? ""));

  return (
    <div className="flex flex-col gap-3" data-testid="groups">
      {groups.length === 0 ? (
        <p className="rounded-md bg-secondary p-4 text-sm">
          For Johns only some of you share, like one of two bathrooms. Everything else stays with the whole house.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((g) => (
            <li key={g.id} className="flex items-center gap-3 rounded-md border border-border py-2.5 pr-2 pl-3">
              <UsersIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-bold">{g.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {g.memberIds.length === 0
                    ? "Nobody left in it: its Johns go to everyone."
                    : g.memberIds.map((id) => (
                        <span key={id} className="inline-flex items-center gap-1">
                          <Avatar
                            name={people.find((p) => p.userId === id)?.name ?? "?"}
                            me={id === me}
                            className="size-5 text-[9px]"
                          />
                          {nameOf(id)}
                        </span>
                      ))}
                </div>
              </div>
              {editable ? (
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label={`Edit ${g.name}`}
                  onClick={() => setEditing({ id: g.id, name: g.name, memberIds: g.memberIds })}
                >
                  <PencilIcon aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => setEditing({ name: "", memberIds: [] })}
          data-testid="add-group"
        >
          <PlusIcon aria-hidden />
          Make a group
        </Button>
      ) : null}
      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-xl">
          <SheetHeader>
            <SheetTitle>{editing?.id ? `Edit ${editing.name}` : "Make a group"}</SheetTitle>
            <SheetDescription>Who shares it. Johns you give this group only go to them.</SheetDescription>
          </SheetHeader>
          {editing ? (
            <GroupForm key={editing.id ?? "new"} initial={editing} people={people} me={me} onDone={() => setEditing(null)} />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function GroupForm({
  initial,
  people,
  me,
  onDone,
}: {
  initial: { id?: string; name: string; memberIds: string[] };
  people: Person[];
  me: string;
  onDone: () => void;
}) {
  const { pending, run } = useAction();
  const [name, setName] = useState(initial.name);
  const [picked, setPicked] = useState(new Set(initial.memberIds));
  const toggle = (id: string) =>
    setPicked((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form
      className="flex flex-col gap-4 px-4 pb-6"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveGroup({ id: initial.id, name, members: [...picked] }), onDone);
      }}
    >
      <div>
        <FieldLabel htmlFor="group-name">Name</FieldLabel>
        <Input
          id="group-name"
          value={name}
          maxLength={40}
          required
          placeholder="Upstairs bathroom"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="eyebrow mb-2">Who&rsquo;s in it</legend>
        {people.map((p) => (
          <label
            key={p.userId}
            className="flex min-h-11 items-center gap-3 rounded-md border px-3 has-checked:border-foreground"
          >
            <input type="checkbox" checked={picked.has(p.userId)} onChange={() => toggle(p.userId)} />
            <Avatar name={p.name} me={p.userId === me} className="size-6 text-[10px]" />
            <span className="font-bold">{p.userId === me ? "You" : p.name}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || picked.size === 0 || !name.trim()} className="flex-1">
          {pending ? "Saving…" : initial.id ? "Save" : "Make the group"}
        </Button>
        {initial.id ? (
          <Button type="button" variant="destructive" disabled={pending} onClick={() => run(() => deleteGroup(initial.id!), onDone)}>
            Delete
          </Button>
        ) : null}
      </div>
    </form>
  );
}
