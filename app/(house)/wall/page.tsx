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
import { nameOf, requireHouse, type HouseContext } from "@/lib/data/house";
import { getWall, type WallEvent } from "@/lib/data/wall";
import { dateRange, monthLabel, relative } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "The Wall" };

type Line = { icon: typeof CheckIcon; text: React.ReactNode; tone?: "good" | "hazard" | "hivis" };

function describe(e: WallEvent, ctx: HouseContext): Line {
  const who = nameOf(ctx, e.userId);
  const john = String(e.data.name ?? "a John");
  const against = nameOf(ctx, (e.data.against as string) ?? null);
  const possessive = (name: string) => (name === "You" ? "your" : `${name}'s`);
  switch (e.kind) {
    case "done":
      return { icon: CheckIcon, tone: "good", text: <><b>{who}</b> did {john}.</> };
    case "late":
      return { icon: CheckIcon, text: <><b>{who}</b> did {john}, late.</> };
    case "missed":
      return { icon: XIcon, tone: "hazard", text: <><b>{who}</b> missed {john}.</> };
    case "disputed":
      return {
        icon: FlagIcon,
        tone: "hazard",
        text: (
          <>
            <b>{who}</b> disputed {possessive(against)} {john}: &ldquo;{String(e.data.reason ?? "")}&rdquo;
          </>
        ),
      };
    case "upheld":
      return { icon: GavelIcon, tone: "hazard", text: <>The house struck {possessive(against)} tick on {john}. It&rsquo;s open again.</> };
    case "rejected":
      return { icon: GavelIcon, tone: "good", text: <>The house backed {possessive(against)} {john}. The tick stands.</> };
    case "immunity_earned":
      return { icon: ShieldIcon, tone: "hivis", text: <><b>{who}</b> earned an immunity token: {String(e.data.streak)} clean weeks in a row.</> };
    case "swap_earned":
      return { icon: RepeatIcon, tone: "hivis", text: <><b>{who}</b> topped the week and earned a swap.</> };
    case "immunity_used":
      return { icon: ShieldIcon, text: <><b>{who}</b> spent immunity on {john}.</> };
    case "swap_used":
      return {
        icon: RepeatIcon,
        text: (
          <>
            <b>{who}</b> swapped {String(e.data.gave)} for {possessive(nameOf(ctx, (e.data.with as string) ?? null))} {String(e.data.took)}.
          </>
        ),
      };
    case "away": {
      const moved = Number(e.data.moved ?? 0);
      return {
        icon: PlaneIcon,
        text: (
          <>
            <b>{who}</b> {who === "You" ? "are" : "is"} away {dateRange(String(e.data.starts_on), String(e.data.ends_on))}.
            {moved > 0 ? ` ${moved} ${moved === 1 ? "John is" : "Johns are"} due before ${who === "You" ? "you go" : "they go"}.` : ""}
          </>
        ),
      };
    }
    case "joined":
      return { icon: UserPlusIcon, text: <><b>{who}</b> moved in.</> };
    case "month_closed":
      return { icon: CalendarCheckIcon, text: <>{monthLabel(String(e.data.month))} is closed and the Stake is shared out.</> };
    case "paid":
      return {
        icon: BanknoteIcon,
        tone: "good",
        text: (
          <>
            <b>{nameOf(ctx, (e.data.to as string) ?? null)}</b> got {formatMoney(Number(e.data.amount), ctx.rules.currency)} from {who}.
          </>
        ),
      };
    default:
      return { icon: BadgeCheckIcon, text: <>{e.kind}</> };
  }
}

const REACTABLE = new Set(["done", "late", "missed", "rejected", "upheld", "immunity_earned", "swap_earned"]);

export default async function WallPage() {
  const ctx = await requireHouse();
  const events = await getWall(ctx);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow={ctx.house.name} title="The Wall" />
      {events.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          Ticks, misses, disputes and perks land here as they happen.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {events.map((e) => {
            const line = describe(e, ctx);
            const Icon = line.icon;
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
                      {line.text}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{relative(e.createdAt, ctx.now)}</p>
                    {e.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived URL: nothing for the optimiser to cache
                      <img
                        src={e.photoUrl}
                        alt={`Photo of ${String(e.data.name ?? "the John")}`}
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
