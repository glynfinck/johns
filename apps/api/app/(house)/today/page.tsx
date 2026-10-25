import {
  addDaysTo,
  currentOrNext,
  dateRange,
  formatBalance,
  formatMoney,
  formatSigned,
  isOpen,
  TODAY_COPY,
  todayView,
  weekRange,
} from "@app/core";
import { FlameIcon, PlaneIcon, RepeatIcon, ShieldIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { InviteCard } from "@/components/house/invite-card";
import { JohnCard } from "@/components/johns/john-card";
import { NotDealt } from "@/components/johns/not-dealt";
import { PageHeader } from "@/components/shell/app-shell";
import { Standings } from "@/components/table/standings";
import { SITE_URL } from "@/lib/config";
import { getAway } from "@/lib/data/away";
import { getBalances } from "@/lib/data/balance";
import { requireHouse } from "@/lib/data/house";
import { getStake } from "@/lib/data/stake";
import { getWeekBoard } from "@/lib/data/week";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const ctx = await requireHouse();
  const [board, stake, away, balances] = await Promise.all([
    getWeekBoard(ctx),
    getStake(ctx),
    getAway(ctx),
    getBalances(ctx),
  ]);
  const trip = currentOrNext(away.periods, ctx.userId, away.today);
  const showTrip = trip && trip.startsOn <= addDaysTo(away.today, 14) ? trip : null;
  const myBalance = balances.find((b) => b.userId === ctx.userId);
  const { rules, now, me } = ctx;
  const names = new Map(ctx.members.map((m) => [m.userId, m.name]));
  const admin = ctx.members.find((m) => m.role === "admin");

  const { mine, left, toVote } = todayView(board, ctx.userId);
  const myMonth = stake.projection.find((p) => p.userId === ctx.userId);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={
          board.week ? TODAY_COPY.thisWeekRange(weekRange(board.week.startsAt, board.week.endsAt, rules.timezone)) : TODAY_COPY.thisWeek
        }
        title={TODAY_COPY.title}
      />

      {showTrip ? (
        <section
          className="mb-5 flex items-start gap-3 rounded-lg border border-border bg-card p-4"
          aria-label="Your time away"
          data-testid="away-banner"
        >
          <PlaneIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-extrabold">
              {showTrip.startsOn <= away.today
                ? `You're away until ${dateRange(showTrip.endsOn, showTrip.endsOn)}.`
                : `You're away ${dateRange(showTrip.startsOn, showTrip.endsOn)}.`}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Nobody hands you a John due while you&rsquo;re gone
              {ctx.house.away_makeup > 0
                ? `, but ${ctx.house.away_makeup === 100 ? "your share" : "half your share"} still counts: you catch up a little each week when you're back.`
                : "."}
            </p>
          </div>
          <Link href="/house#away" className="text-xs font-bold underline-offset-2 hover:underline">
            Change
          </Link>
        </section>
      ) : null}

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
                <div className="font-extrabold">{TODAY_COPY.left(left)}</div>
                <div className="mt-2 flex gap-1" aria-hidden>
                  {mine.map((i) => (
                    <span key={i.id} className={`h-1.5 w-7 rounded-sm ${isOpen(i.status) ? "bg-secondary" : "bg-good"}`} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="inline-flex items-center gap-1 rounded bg-hivis px-2 py-1 text-xs font-black tracking-wide text-on-hivis uppercase">
                  <FlameIcon className="size-3.5" aria-hidden />
                  {TODAY_COPY.streak(me.streak)}
                </span>
                {me.immunityTokens > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
                    <ShieldIcon className="size-3.5" aria-hidden /> {TODAY_COPY.immunity(me.immunityTokens)}
                  </span>
                ) : null}
                {me.swapTokens > 0 ? (
                  <Link href="/week" className="inline-flex items-center gap-1 text-xs font-bold underline-offset-2 hover:underline">
                    <RepeatIcon className="size-3.5" aria-hidden /> {TODAY_COPY.swapReady}
                  </Link>
                ) : null}
              </div>
            </section>

            {toVote.length > 0 ? (
              <section className="flex flex-col gap-3">
                <h2 className="eyebrow">{TODAY_COPY.toVote}</h2>
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
              {toVote.length > 0 ? <h2 className="eyebrow">{TODAY_COPY.yours}</h2> : null}
              {mine.length === 0 ? (
                <p className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
                  {TODAY_COPY.nothingYours}
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
            {myBalance ? (
              <section className="rounded-lg border border-border bg-card p-4" data-testid="my-share">
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="eyebrow">Your share, lately</h2>
                  <Link href="/table#shares" className="text-xs font-bold underline-offset-2 hover:underline">
                    Everyone&rsquo;s
                  </Link>
                </div>
                <p className="text-3xl font-black tabular">{formatBalance(myBalance.balance)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {myBalance.balance <= -0.5
                    ? `Points behind your share. The next weeks hand you a little extra, never more than half a week's worth, for about ${myBalance.weeksToEven} ${myBalance.weeksToEven === 1 ? "week" : "weeks"}.`
                    : myBalance.balance >= 0.5
                      ? "Points ahead of your share, so the next weeks go a little easier on you."
                      : "You've done your share."}
                </p>
              </section>
            ) : null}
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
                  If the month ended now:{" "}
                  <span className="whitespace-nowrap">{formatSigned(myMonth.net, rules.currency)}</span>.
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
