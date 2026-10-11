"use client";

import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { joinHouse } from "@/lib/actions/house";

export function JoinButton({ code, houseName }: { code: string; houseName: string }) {
  const { pending, run } = useAction();
  return (
    <Button disabled={pending} onClick={() => run(() => joinHouse(code))} data-testid="join-house">
      {pending ? "Joining…" : `Join ${houseName}`}
    </Button>
  );
}
