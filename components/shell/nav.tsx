"use client";

import {
  CalendarDaysIcon,
  CoinsIcon,
  HouseIcon,
  ListChecksIcon,
  MessagesSquareIcon,
  TrophyIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/today", label: "Today", icon: ListChecksIcon },
  { href: "/week", label: "Week", icon: CalendarDaysIcon },
  { href: "/wall", label: "Wall", icon: MessagesSquareIcon },
  { href: "/table", label: "Table", icon: TrophyIcon },
  { href: "/stake", label: "Stake", icon: CoinsIcon },
] as const;

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Laptop: a column of signs down the left. */
export function SideNav() {
  const active = useActive();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {[...NAV, { href: "/house", label: "House", icon: HouseIcon }].map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={active(href) ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-bold tracking-wide uppercase transition-colors",
            active(href)
              ? "bg-hivis text-on-hivis"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          <Icon className="size-[18px]" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Phone: five tabs along the bottom, thumb-height. */
export function TabBar() {
  const active = useActive();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="mx-auto grid max-w-xl grid-cols-5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const on = active(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-bold tracking-wide uppercase",
                on ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {on ? <span aria-hidden className="absolute inset-x-4 top-0 h-[3px] rounded-b bg-hivis" /> : null}
              <Icon className="size-5" strokeWidth={on ? 2.4 : 1.9} aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
