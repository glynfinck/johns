"use client";

import { JOIN_COPY } from "@app/core";

import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { joinHouse } from "@/lib/actions/house";

export function JoinButton({ code, houseName }: { code: string; houseName: string }) {
  const { pending, run } = useAction();
  return (
    <Button disabled={pending} onClick={() => run(() => joinHouse(code))} data-testid="join-house">
      {pending ? JOIN_COPY.joining : JOIN_COPY.join(houseName)}
    </Button>
  );
}
