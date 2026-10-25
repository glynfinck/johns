"use client";

import { JOHN_COPY, PROOF_QUALITY, proofPath, proofSize } from "@app/core";
import { CameraIcon, CheckIcon, FlagIcon, RepeatIcon, ShieldIcon, ThumbsDownIcon, ThumbsUpIcon, Undo2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { castVote, markDone, raiseDispute, spendImmunity, spendSwap, undoDone } from "@/lib/actions/johns";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Shrink a phone photo to something worth uploading, as core says: a JPEG of `proofSize`. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const size = proofSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read that photo"))), "image/jpeg", PROOF_QUALITY),
  );
}

/**
 * The tick. On a photo John the button opens the camera and the photo goes
 * up first; on any other John a photo is offered but never required.
 */
export function MarkDone({
  assignmentId,
  houseId,
  needsPhoto,
  compact = false,
  className,
}: {
  assignmentId: string;
  houseId: string;
  needsPhoto: boolean;
  /** One small button, for the laptop board's table cells. */
  compact?: boolean;
  className?: string;
}) {
  const { pending, run } = useAction();
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = pending || uploading;

  async function withPhoto(file: File) {
    setUploading(true);
    try {
      const blob = await shrink(file);
      const path = proofPath(houseId, assignmentId, crypto.randomUUID());
      const { error } = await createClient().storage.from("proofs").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      run(() => markDone(assignmentId, path));
    } catch {
      toast.error(JOHN_COPY.photoFailed);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void withPhoto(file);
        }}
      />
      {compact ? (
        <Button
          size="compact"
          disabled={busy}
          onClick={() => (needsPhoto ? input.current?.click() : run(() => markDone(assignmentId)))}
        >
          {needsPhoto ? <CameraIcon aria-hidden /> : <CheckIcon aria-hidden />}
          {busy ? "…" : "Done"}
        </Button>
      ) : needsPhoto ? (
        <Button className="flex-1" disabled={busy} onClick={() => input.current?.click()} data-testid="mark-done">
          <CameraIcon aria-hidden />
          {busy ? JOHN_COPY.uploading : JOHN_COPY.photoAndDone}
        </Button>
      ) : (
        <>
          <Button className="flex-1" disabled={busy} onClick={() => run(() => markDone(assignmentId))} data-testid="mark-done">
            <CheckIcon aria-hidden />
            {pending ? JOHN_COPY.ticking : JOHN_COPY.markDone}
          </Button>
          <Button
            variant="outline"
            aria-label={JOHN_COPY.withPhoto}
            disabled={busy}
            onClick={() => input.current?.click()}
            className="px-4"
          >
            <CameraIcon aria-hidden />
          </Button>
        </>
      )}
    </div>
  );
}

export function UndoDone({ assignmentId }: { assignmentId: string }) {
  const { pending, run } = useAction();
  return (
    <Button variant="ghost" disabled={pending} onClick={() => run(() => undoDone(assignmentId))}>
      <Undo2Icon aria-hidden />
      {JOHN_COPY.undo}
    </Button>
  );
}

/** Housemate check: say what's wrong with someone's tick, and the house votes. */
export function DisputeButton({ assignmentId, john, owner }: { assignmentId: string; john: string; owner: string }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="text-muted-foreground">
          <FlagIcon aria-hidden />
          Dispute
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-xl">
        <SheetHeader>
          <SheetTitle>Was {john} really done?</SheetTitle>
          <SheetDescription>
            {owner}&rsquo;s tick goes to a house vote. If the house agrees with you, the John opens again.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-col gap-3 px-4 pb-6"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => raiseDispute(assignmentId, reason), () => setOpen(false));
          }}
        >
          <label htmlFor="dispute-reason" className="eyebrow">
            What&rsquo;s wrong with it
          </label>
          <Textarea
            id="dispute-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={280}
            placeholder="The hob's still greasy"
            required
          />
          <Button type="submit" disabled={pending || !reason.trim()}>
            {pending ? "Sending…" : "Put it to the house"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function VoteButtons({ disputeId, myVote }: { disputeId: string; myVote: boolean | null }) {
  const { pending, run } = useAction();
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant={myVote === false ? "default" : "outline"}
        disabled={pending}
        onClick={() => run(() => castVote(disputeId, false))}
      >
        <ThumbsUpIcon aria-hidden />
        It&rsquo;s fine
      </Button>
      <Button
        variant={myVote === true ? "destructive" : "outline"}
        disabled={pending}
        onClick={() => run(() => castVote(disputeId, true))}
      >
        <ThumbsDownIcon aria-hidden />
        Not done
      </Button>
    </div>
  );
}

export function UseImmunity({ assignmentId, tokens }: { assignmentId: string; tokens: number }) {
  const { pending, run } = useAction();
  const [confirm, setConfirm] = useState(false);
  if (tokens < 1) return null;
  return confirm ? (
    <div className="flex items-center gap-2">
      <Button disabled={pending} onClick={() => run(() => spendImmunity(assignmentId))}>
        <ShieldIcon aria-hidden />
        {JOHN_COPY.spendIt}
      </Button>
      <Button variant="ghost" onClick={() => setConfirm(false)}>
        {JOHN_COPY.keepIt}
      </Button>
    </div>
  ) : (
    <Button variant="ghost" onClick={() => setConfirm(true)}>
      <ShieldIcon aria-hidden />
      {JOHN_COPY.useImmunity}
    </Button>
  );
}

/** Top of the table: trade one of your open Johns for a housemate's. */
export function SwapSheet({
  mine,
  theirs,
}: {
  mine: { id: string; name: string }[];
  theirs: { id: string; name: string; owner: string }[];
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [give, setGive] = useState(mine[0]?.id ?? "");
  const [take, setTake] = useState("");
  if (mine.length === 0 || theirs.length === 0) return null;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <RepeatIcon aria-hidden />
          Use your swap
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-xl">
        <SheetHeader>
          <SheetTitle>Swap a John</SheetTitle>
          <SheetDescription>You topped the table, so you pick. They get yours, you get theirs.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="eyebrow mb-2">Give away</legend>
            {mine.map((m) => (
              <label key={m.id} className="flex min-h-11 items-center gap-3 rounded-md border px-3 has-checked:border-foreground">
                <input type="radio" name="give" value={m.id} checked={give === m.id} onChange={() => setGive(m.id)} />
                <span className="font-bold">{m.name}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="eyebrow mb-2">Take instead</legend>
            {theirs.map((t) => (
              <label key={t.id} className="flex min-h-11 items-center gap-3 rounded-md border px-3 has-checked:border-foreground">
                <input type="radio" name="take" value={t.id} checked={take === t.id} onChange={() => setTake(t.id)} />
                <span className="font-bold">{t.name}</span>
                <span className="ml-auto text-sm text-muted-foreground">{t.owner}</span>
              </label>
            ))}
          </fieldset>
          <Button disabled={pending || !give || !take} onClick={() => run(() => spendSwap(give, take), () => setOpen(false))}>
            {pending ? "Swapping…" : "Swap them"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
