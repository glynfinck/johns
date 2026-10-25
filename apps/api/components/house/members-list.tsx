"use client";

import { MEMBERS_COPY } from "@app/core";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { removeMember, setRole } from "@/lib/actions/house";

export interface MemberView {
  userId: string;
  name: string;
  role: "admin" | "member";
  streak: number;
}

/** Who lives here. Admins can promote, demote and ask someone to leave. */
export function MembersList({ members, me, isAdmin }: { members: MemberView[]; me: string; isAdmin: boolean }) {
  const { pending, run } = useAction();
  const [removing, setRemoving] = useState<string | null>(null);

  return (
    <ul className="flex flex-col divide-y divide-border">
      {members.map((m) => (
        <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
          <Avatar name={m.name} me={m.userId === me} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">
              {m.name}
              {m.userId === me ? <span className="text-muted-foreground"> {MEMBERS_COPY.you}</span> : null}
            </div>
            <div className="text-xs text-muted-foreground">{m.role === "admin" ? MEMBERS_COPY.admin : MEMBERS_COPY.housemate}</div>
          </div>
          {isAdmin && m.userId !== me ? (
            removing === m.userId ? (
              <div className="flex gap-1.5">
                <Button size="compact" variant="destructive" disabled={pending} onClick={() => run(() => removeMember(m.userId))}>
                  {MEMBERS_COPY.removeName(m.name)}
                </Button>
                <Button size="compact" variant="ghost" onClick={() => setRemoving(null)}>
                  {MEMBERS_COPY.cancel}
                </Button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <Button
                  size="compact"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => setRole(m.userId, m.role === "admin" ? "member" : "admin"))}
                >
                  {m.role === "admin" ? MEMBERS_COPY.makeHousemate : MEMBERS_COPY.makeAdmin}
                </Button>
                <Button size="compact" variant="ghost" onClick={() => setRemoving(m.userId)}>
                  {MEMBERS_COPY.remove}
                </Button>
              </div>
            )
          ) : null}
        </li>
      ))}
    </ul>
  );
}
