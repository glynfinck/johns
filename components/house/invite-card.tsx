"use client";

import { CopyIcon, Share2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** The join link, ready for the group chat. */
export function InviteCard({ url, code, houseName }: { url: string; code: string; houseName: string }) {
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${houseName} on Johhs`, url });
        return;
      } catch {
        // Cancelled, or the share sheet is unavailable: fall back to copying.
      }
    }
    await copy();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Long-press the link instead.");
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="eyebrow mb-2">Invite the house</h2>
      <p className="text-sm">Send this link to the group chat. Anyone with it can join after signing in.</p>
      <p className="mt-3 rounded-md bg-secondary px-3 py-2.5 font-mono text-[13px] break-all select-all" data-testid="invite-url">
        {url}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Code <span className="font-mono font-bold tracking-widest text-foreground">{code}</span>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={() => void share()}>
          <Share2Icon aria-hidden />
          Share
        </Button>
        <Button variant="outline" onClick={() => void copy()}>
          <CopyIcon aria-hidden />
          Copy
        </Button>
      </div>
    </section>
  );
}
