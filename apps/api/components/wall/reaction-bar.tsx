"use client";

import { REACTION_LABEL, toggled, type ReactionKind } from "@app/core";
import { EyeIcon, FlameIcon, SparklesIcon, ThumbsUpIcon } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { toggleReaction } from "@/lib/actions/johns";
import type { WallEvent } from "@/lib/data/wall";
import { cn } from "@/lib/utils";

// Icons, not emoji: the house style has none.
const KINDS: { kind: ReactionKind; label: string; Icon: typeof FlameIcon }[] = [
  { kind: "nice", label: REACTION_LABEL.nice, Icon: ThumbsUpIcon },
  { kind: "fire", label: REACTION_LABEL.fire, Icon: FlameIcon },
  { kind: "sparkle", label: REACTION_LABEL.sparkle, Icon: SparklesIcon },
  { kind: "eyes", label: REACTION_LABEL.eyes, Icon: EyeIcon },
];

export function ReactionBar({ eventId, reactions }: { eventId: string; reactions: WallEvent["reactions"] }) {
  const [, startTransition] = useTransition();
  const [shown, flip] = useOptimistic(reactions, (state, kind: ReactionKind) => toggled(state, kind));

  return (
    <div className="flex flex-wrap gap-1.5">
      {KINDS.map(({ kind, label, Icon }) => {
        const r = shown[kind];
        return (
          <button
            key={kind}
            type="button"
            aria-label={label}
            aria-pressed={r.mine}
            title={label}
            onClick={() =>
              startTransition(async () => {
                flip(kind);
                const result = await toggleReaction(eventId, kind, !r.mine);
                if (result?.error) toast.error(result.error);
              })
            }
            className={cn(
              "inline-flex h-9 min-w-11 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-extrabold tabular transition-colors",
              r.mine ? "border-foreground bg-hivis text-on-hivis" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {r.count > 0 ? r.count : null}
          </button>
        );
      })}
    </div>
  );
}
