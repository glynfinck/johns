import { describeEvent, REACTABLE, relative, WALL_COPY, type WallIcon } from "@app/core";
import {
  BadgeCheckIcon,
  BanknoteIcon,
  CalendarCheckIcon,
  CheckIcon,
  FlagIcon,
  GavelIcon,
  PlaneIcon,
  RepeatIcon,
  ShieldIcon,
  UserPlusIcon,
  XIcon,
} from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { ReactionBar } from "@/components/wall/reaction-bar";
import { nameOf, requireHouse } from "@/lib/data/house";
import { getWall } from "@/lib/data/wall";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: WALL_COPY.title };

// Core says what happened and which icon fits; these draw it.
const ICON: Record<WallIcon, typeof CheckIcon> = {
  check: CheckIcon,
  x: XIcon,
  flag: FlagIcon,
  gavel: GavelIcon,
  shield: ShieldIcon,
  repeat: RepeatIcon,
  plane: PlaneIcon,
  "user-plus": UserPlusIcon,
  "calendar-check": CalendarCheckIcon,
  banknote: BanknoteIcon,
  "badge-check": BadgeCheckIcon,
};

export default async function WallPage() {
  const ctx = await requireHouse();
  const events = await getWall(ctx);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow={ctx.house.name} title={WALL_COPY.title} />
      {events.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">{WALL_COPY.empty}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {events.map((e) => {
            const line = describeEvent(e, (id) => nameOf(ctx, id), ctx.rules.currency);
            const Icon = ICON[line.icon];
            return (
              <li key={e.id} className="relative overflow-hidden rounded-lg border border-border bg-card" data-testid="wall-event">
                {line.tone === "hazard" ? <span aria-hidden className="hazard-tape absolute inset-y-0 left-0 w-1.5" /> : null}
                <div className="flex gap-3 p-4">
                  {e.userId ? (
                    <Avatar name={nameOf(ctx, e.userId) === "You" ? ctx.me.name : nameOf(ctx, e.userId)} me={e.userId === ctx.userId} />
                  ) : (
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary">
                      <Icon className="size-4" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-snug">
                      <Icon
                        aria-hidden
                        className={cn(
                          "mr-1.5 inline size-4 -translate-y-px",
                          line.tone === "good" && "text-good",
                          line.tone === "hazard" && "text-hazard",
                        )}
                      />
                      {line.parts.map((part, i) => (part.bold ? <b key={i}>{part.text}</b> : part.text))}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{relative(e.createdAt, ctx.now)}</p>
                    {e.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived URL: nothing for the optimiser to cache
                      <img
                        src={e.photoUrl}
                        alt={WALL_COPY.photoOf(String(e.data.name ?? "the John"))}
                        className="mt-3 max-h-96 w-full rounded-md border border-border object-cover"
                        loading="lazy"
                      />
                    ) : null}
                    {REACTABLE.has(e.kind) ? (
                      <div className="mt-3">
                        <ReactionBar eventId={e.id} reactions={e.reactions} />
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
