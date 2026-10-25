"use client";

import { useTransition } from "react";
import { toast } from "sonner";

export type ActionOutcome = { error?: string } | void;

/**
 * Run a server action with a pending flag and a toast on refusal. Success
 * is the screen's to show (the John flips to done), not a toast's to narrate.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionOutcome>, onDone?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result && result.error) {
        toast.error(result.error);
        return;
      }
      onDone?.();
    });
  }

  return { pending, run };
}
