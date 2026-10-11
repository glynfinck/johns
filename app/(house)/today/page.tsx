import { FlameIcon, RepeatIcon, ShieldIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { InviteCard } from "@/components/house/invite-card";
import { JohnCard } from "@/components/johns/john-card";
import { NotDealt } from "@/components/johns/not-dealt";
import { PageHeader } from "@/components/shell/app-shell";
import { Standings } from "@/components/table/standings";
import { SITE_URL } from "@/lib/config";
import { requireHouse } from "@/lib/data/house";
import { getStake } from "@/lib/data/stake";
import { getWeekBoard, type BoardItem } from "@/lib/data/week";
import { weekRange } from "@/lib/format";
import { formatMoney, formatSigned } from "@/lib/money";

export const metadata: Metadata = { title: "Today" };

const ORDER: Record<string, number> = {
  overdue: 0,
  "due-soon": 1,
  upcoming: 2,
  disputed: 3,
  checking: 4,
  late: 5,
  done: 6,
  excused: 7,
  missed: 8,
};
const isOpen = (i: BoardItem) => i.status === "overdue" || i.status === "due-soon" || i.status === "upcoming";

export default async function TodayPage() {
  const ctx = await requireHouse();
  const [board, stake] = await Promise.all([getWeekBoard(ctx), getStake(ctx)]);
  const { rules, now, me } = ctx;
  const names = new Map(ctx.members.map((m) => [m.userId, m.name]));
  const admin = ctx.members.find((m) => m.role === "admin");

  const mine = board.items
    .filter((i) => i.userId === ctx.userId)
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.dueAt.getTime() - b.dueAt.getTime());
  const left = mine.filter(isOpen).length;
  const toVote = board.items.filter((i) => i.dispute && i.userId !== ctx.userId && i.dispute.myVote === null);
  const myMonth = stake.projection.find((p) => p.userId === ctx.userId);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={board.week ? `This week · ${weekRange(board.week.startsAt, board.week.endsAt, rules.timezone)}` : "This week"}
        title="Your Johns"
      />

      {!board.week ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <NotDealt notStarted={board.notStarted} isAdmin={ctx.isAdmin} adminName={admin?.name ?? "An admin"} />
          <InviteCard url={`${SITE_URL}/join/${ctx.house.join_code}`} code={ctx.house.join_code} houseName={ctx.house.name} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-5">
            <section
              aria-label="Your week"
              className="flex items-center gap-4 rounded-lg border border-l-[10px] border-border border-l-hivis bg-card p-4"
            >
              <span className="text-[52px] leading-none font-black tabular" data-testid="johns-left">
                {left}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold">{left === 1 ? "John left this week" : "Johns left this week"}</div>
                <div className="mt-2 flex gap-1" aria-hidden>
                  {mine.map((i) => (
                    <span key={i.id} className={`h-1.5 w-7 rounded-sm ${isOpen(i) ? "bg-secondary" : "bg-good"}`} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="inline-flex items-center gap-1 rounded bg-hivis px-2 py-1 text-xs font-black tracking-wide text-on-hivis uppercase">
                  <FlameIcon className="size-3.5" aria-hidden />
                  {me.streak} {me.streak === 1 ? "week" : "weeks"}
                </span>
                {me.immunityTokens > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
                    <ShieldIcon className="size-3.5" aria-hidden /> {me.immunityTokens} immunity
                  </span>
                ) : null}
                {me.swapTokens > 0 ? (
                  <Link href="/week" className="inline-flex items-center gap-1 text-xs font-bold underline-offset-2 hover:underline">
                    <RepeatIcon className="size-3.5" aria-hidden /> swap ready
                  </Link>
                ) : null}
              </div>
            </section>

            {toVote.length > 0 ? (
              <section className="flex flex-col gap-3">
                <h2 className="eyebrow">The house wants your vote</h2>
                {toVote.map((i) => (
                  <JohnCard
                    key={i.id}
                    item={i}
                    ownerName={names.get(i.userId) ?? "Someone"}
                    mine={false}
                    houseId={ctx.house.id}
                    zone={rules.timezone}
                    now={now}
                    showOwner
                  />
                ))}
              </section>
            ) : null}

            <section className="flex flex-col gap-3">
              {toVote.length > 0 ? <h2 className="eyebrow">Yours</h2> : null}
              {mine.length === 0 ? (
                <p className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
                  Nothing on your list this week. Enjoy it while it lasts.
                </p>
              ) : (
                mine.map((i) => (
                  <JohnCard
                    key={i.id}
                    item={i}
                    ownerName="You"
                    mine
                    houseId={ctx.house.id}
                    zone={rules.timezone}
                    now={now}
                    immunityTokens={me.immunityTokens}
                  />
                ))
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-4">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="eyebrow">The Table · this week</h2>
                <Link href="/table" className="text-xs font-bold underline-offset-2 hover:underline">
                  Full table
                </Link>
              </div>
              <Standings rows={board.table} names={names} me={ctx.userId} dense />
            </section>
            {myMonth ? (
              <section className="rounded-lg border border-border bg-card p-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="eyebrow">Your stake this month</h2>
                  <Link href="/stake" className="text-xs font-bold underline-offset-2 hover:underline">
                    The Stake
                  </Link>
                </div>
                <p className="text-3xl font-black tabular">{formatMoney(stake.stakeMinor, rules.currency)}</p>
                <p className="mt-1 text-sm text-muted-foreground tabular">
                  {myMonth.forfeited > 0
                    ? `${formatMoney(myMonth.forfeited, rules.currency)} forfeited so far.`
                    : "Nothing forfeited so far."}{" "}
                  If the month ended now: {formatSigned(myMonth.net, rules.currency)}.
                </p>
              </section>
            ) : null}
            {ctx.members.length < 2 ? (
              <InviteCard url={`${SITE_URL}/join/${ctx.house.join_code}`} code={ctx.house.join_code} houseName={ctx.house.name} />
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
