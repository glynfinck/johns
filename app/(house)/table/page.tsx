import { FlameIcon, RepeatIcon, ShieldIcon } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/app-shell";
import { Standings } from "@/components/table/standings";
import { Avatar } from "@/components/ui/avatar";
import { requireHouse } from "@/lib/data/house";
import { getMonthTable, getWeekBoard } from "@/lib/data/week";
import { monthLabel } from "@/lib/format";
import { IMMUNITY_EVERY } from "@/lib/streak";

export const metadata: Metadata = { title: "The Table" };

export default async function TablePage() {
  const ctx = await requireHouse();
  const [board, month] = await Promise.all([getWeekBoard(ctx), getMonthTable(ctx)]);
  const names = new Map(ctx.members.map((m) => [m.userId, m.name]));
  const byStreak = [...ctx.members].sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Effort points" title="The Table" />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="eyebrow mb-4">This week</h2>
          <Standings rows={board.table} names={names} me={ctx.userId} />
        </section>
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="eyebrow mb-4">{monthLabel(month.month)}</h2>
          <Standings rows={month.table} names={names} me={ctx.userId} />
        </section>

        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h2 className="eyebrow mb-4">Streaks and perks</h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {byStreak.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 rounded-md border border-border p-3">
                <Avatar name={m.name} me={m.userId === ctx.userId} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{m.userId === ctx.userId ? "You" : m.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular">
                    <span className="inline-flex items-center gap-1">
                      <FlameIcon className="size-3.5" aria-hidden />
                      {m.streak} {m.streak === 1 ? "week" : "weeks"}
                    </span>
                    {m.immunityTokens > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <ShieldIcon className="size-3.5" aria-hidden />
                        {m.immunityTokens}
                      </span>
                    ) : null}
                    {m.swapTokens > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <RepeatIcon className="size-3.5" aria-hidden />
                        swap
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-extrabold">Points</dt>
              <dd className="text-muted-foreground">
                A Johh done on time earns its points. A late one earns half. A missed one earns nothing.
              </dd>
            </div>
            <div>
              <dt className="font-extrabold">Immunity</dt>
              <dd className="text-muted-foreground">
                Every {IMMUNITY_EVERY} clean weeks in a row earns a token (hold up to two). Spend one to skip a Johh
                with no forfeit.
              </dd>
            </div>
            <div>
              <dt className="font-extrabold">Swap</dt>
              <dd className="text-muted-foreground">
                Top the week and you can trade one of your open Johhs for anyone&rsquo;s, once.
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
