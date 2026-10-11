import { SettingsIcon } from "lucide-react";
import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { SideNav, TabBar } from "@/components/shell/nav";
import { Avatar } from "@/components/ui/avatar";

/**
 * Every house screen sits in this. It grows rather than staying a phone
 * column: tabs along the bottom on a phone, a sidebar of signs from laptop
 * width up, where the pages themselves spread into more columns.
 */
export function AppShell({
  houseId,
  houseName,
  memberCount,
  me,
  children,
}: {
  houseId: string;
  houseName: string;
  memberCount: number;
  me: { name: string; streak: number; immunityTokens: number; swapTokens: number };
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1 lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-card px-4 py-6 lg:flex">
        <Link href="/today" className="self-start">
          <Wordmark className="text-[26px]" />
        </Link>
        <div className="px-1">
          <div className="text-sm font-extrabold">{houseName}</div>
          <div className="text-xs text-muted-foreground">
            {memberCount} {memberCount === 1 ? "housemate" : "housemates"}
          </div>
        </div>
        <SideNav />
        <div className="mt-auto flex items-center gap-3 border-t border-border px-1 pt-4">
          <Avatar name={me.name} me />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{me.name}</div>
            <div className="text-xs text-muted-foreground tabular">
              {me.streak}-week streak · {me.immunityTokens + me.swapTokens}{" "}
              {me.immunityTokens + me.swapTokens === 1 ? "token" : "tokens"}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link href="/today" aria-label="Johhs, today">
              <Wordmark className="text-xl" />
            </Link>
            <span className="min-w-0 flex-1 truncate text-right text-xs font-bold tracking-wide text-muted-foreground uppercase">
              {houseName}
            </span>
            <Link
              href="/house"
              aria-label="House settings"
              className="-mr-2 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <SettingsIcon className="size-5" aria-hidden />
            </Link>
          </div>
        </header>
        <main className="flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-9 lg:pb-12">
          {children}
        </main>
      </div>
      <TabBar />
      <LiveRefresh houseId={houseId} />
    </div>
  );
}

/** The heading every house screen opens with. */
export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 lg:mb-7">
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow mb-1">{eyebrow}</div> : null}
        <h1 className="text-[28px] leading-none font-black tracking-tight text-balance uppercase lg:text-4xl">
          {title}
        </h1>
      </div>
      {action}
    </header>
  );
}
