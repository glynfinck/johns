import { FRONT_DOOR, TAGLINE, type FrontDoorPoint } from "@app/core";
import { CoinsIcon, MessagesSquareIcon, ShuffleIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { getMembership } from "@/lib/data/house";

const ICON: Record<FrontDoorPoint, typeof ShuffleIcon> = {
  deal: ShuffleIcon,
  stake: CoinsIcon,
  wall: MessagesSquareIcon,
};

/** The front door. Signed in, it is only ever a redirect. */
export default async function Home() {
  const { user, houseId } = await getMembership();
  if (user) redirect(houseId ? "/today" : "/house/new");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-12 sm:px-8">
      <header className="flex items-center justify-between py-2">
        <Wordmark className="text-2xl" />
        <Link href="/signin" className="text-sm font-bold underline-offset-4 hover:underline">
          {FRONT_DOOR.signIn}
        </Link>
      </header>

      <section className="relative mt-10 overflow-hidden rounded-lg border border-border bg-card p-6 sm:mt-16 sm:p-10">
        <span aria-hidden className="hazard-tape absolute inset-x-0 top-0 h-2" />
        <p className="eyebrow">{FRONT_DOOR.eyebrow}</p>
        <h1 className="mt-3 max-w-2xl text-[40px] leading-[0.95] font-black tracking-tight text-balance uppercase sm:text-6xl">
          {FRONT_DOOR.headline}
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">{TAGLINE}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/signin">{FRONT_DOOR.start}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/signin">{FRONT_DOOR.join}</Link>
          </Button>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {FRONT_DOOR.points.map(({ key, title, body }) => {
          const Icon = ICON[key];
          return (
            <div key={key} className="rounded-lg border border-border bg-card p-5">
              <Icon className="size-6" aria-hidden />
              <h2 className="mt-3 text-lg font-extrabold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          );
        })}
      </section>

      <footer className="mt-auto flex gap-4 pt-12 text-xs text-muted-foreground">
        <span>Johns</span>
        <Link href="/privacy" className="underline-offset-2 hover:underline">
          Privacy
        </Link>
      </footer>
    </main>
  );
}
