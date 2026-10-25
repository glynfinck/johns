"use client";

import { STAKE_COPY } from "@app/core";
import { BanknoteIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { confirmPayment } from "@/lib/actions/johns";

/** Only the person owed can say the money arrived. */
export function ConfirmReceived({
  houseId,
  fromUserId,
  amount,
  label,
}: {
  houseId: string;
  fromUserId: string;
  amount: number;
  label: string;
}) {
  const { pending, run } = useAction();
  return (
    <Button size="compact" variant="outline" disabled={pending} onClick={() => run(() => confirmPayment(houseId, fromUserId, amount))}>
      <BanknoteIcon aria-hidden />
      {pending ? STAKE_COPY.saving : label}
    </Button>
  );
}
