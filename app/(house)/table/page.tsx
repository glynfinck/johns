import { FlameIcon, RepeatIcon, ShieldIcon } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/app-shell";
import { Standings } from "@/components/table/standings";
import { Avatar } from "@/components/ui/avatar";
import { getBalances } from "@/lib/data/balance";
import { requireHouse } from "@/lib/data/house";
import { getMonthTable, getWeekBoard } from "@/lib/data/week";
import { BALANCE_WEEKS, MAKEUP_LABEL } from "@/lib/deal";
import { formatBalance, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { IMMUNITY_EVERY } from "@/lib/streak";

export const metadata: Metadata = { title: "The Table" };

export default async function TablePage() {
  const ctx = await requireHouse();
  const [board, month, balances] = await Promise.all([getWeekBoard(ctx), getMonthTable(ctx), getBalances(ctx)]);
  const widest = Math.max(1, ...balances.map((b) => Math.abs(b.balance)));
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

        <section id="shares" className="scroll-mt-20 rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h2 className="eyebrow mb-1">Fair shares</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            What each of you was handed over the last {BALANCE_WEEKS} weeks, against your share. Each deal hands a
            little more to whoever is behind, never more than half a week extra, until it evens out.
          </p>
          <ul className="flex flex-col gap-2.5">
            {balances.map((b) => {
              const name = b.userId === ctx.userId ? "You" : (names.get(b.userId) ?? "Housemate");
              const width = `${(Math.abs(b.balance) / widest) * 50}%`;
              return (
                <li key={b.userId} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-bold">
                    <Avatar name={names.get(b.userId) ?? "?"} me={b.userId === ctx.userId} className="size-6 shrink-0 text-[10px]" />
                    <span className="truncate">{name}</span>
                  </span>
                  <span className="relative h-2.5 rounded-sm bg-secondary" aria-hidden>
                    <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/40" />
                    <span
                      className={cn("absolute inset-y-0 rounded-sm", b.balance < 0 ? "right-1/2 bg-hazard" : "left-1/2 bg-good")}
                      style={{ width }}
                    />
                  </span>
                  <span
                    className={cn(
                      "text-right text-sm font-black tabular",
                      b.balance <= -0.5 && "text-hazard",
                      b.balance >= 0.5 && "text-good",
                    )}
                  >
                    {formatBalance(b.balance)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Below zero is behind, above is ahead. Time away is made up:{" "}
            <b className="text-foreground">{MAKEUP_LABEL[ctx.house.away_makeup].toLowerCase()}</b>.
          </p>
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
                A John done on time earns its points. A late one earns half. A missed one earns nothing.
              </dd>
            </div>
            <div>
              <dt className="font-extrabold">Immunity</dt>
              <dd className="text-muted-foreground">
                Every {IMMUNITY_EVERY} clean weeks in a row earns a token (hold up to two). Spend one to skip a John
                with no forfeit.
              </dd>
            </div>
            <div>
              <dt className="font-extrabold">Swap</dt>
              <dd className="text-muted-foreground">
                Top the week and you can trade one of your open Johns for anyone&rsquo;s, once.
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
