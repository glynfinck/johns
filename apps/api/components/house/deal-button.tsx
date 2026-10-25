"use client";

import { ShuffleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { dealThisWeek } from "@/lib/actions/house";

/**
 * Deal this week's Johns. The first time, it is the moment the house
 * begins; afterwards it re-deals a week nobody has ticked anything in.
 */
export function DealButton({ started, className }: { started: boolean; className?: string }) {
  const { pending, run } = useAction();
  return (
    <Button
      className={className}
      variant={started ? "outline" : "default"}
      disabled={pending}
      onClick={() => run(() => dealThisWeek())}
      data-testid="deal-week"
    >
      <ShuffleIcon aria-hidden />
      {pending ? "Dealing…" : started ? "Re-deal this week" : "Hand out this week's Johns"}
    </Button>
  );
}
