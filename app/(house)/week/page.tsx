import type { Metadata } from "next";

import { DealButton } from "@/components/house/start-rota";
import { DisputeButton, MarkDone, SwapSheet, VoteButtons } from "@/components/johhs/johh-actions";
import { JohhCard } from "@/components/johhs/johh-card";
import { lidColor } from "@/components/johhs/lid";
import { NotDealt } from "@/components/johhs/not-dealt";
import { StatusChip } from "@/components/johhs/status-chip";
import { PageHeader } from "@/components/shell/app-shell";
import { Standings } from "@/components/table/standings";
import { Avatar } from "@/components/ui/avatar";
import { requireHouse } from "@/lib/data/house";
import { getWeekBoard } from "@/lib/data/week";
import { dueLabel, firstName, relative, weekRange } from "@/lib/format";
import { pointsEarned } from "@/lib/points";

export const metadata: Metadata = { title: "This week" };

const OPEN = new Set(["upcoming", "due-soon", "overdue"]);

export default async function WeekPage() {
  const ctx = await requireHouse();
  const board = await getWeekBoard(ctx);
  const { rules, now, me } = ctx;
  const names = new Map(ctx.members.map((m) => [m.userId, m.name]));
  const admin = ctx.members.find((m) => m.role === "admin");

  if (!board.week) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader eyebrow="This week" title="The board" />
        <NotDealt notStarted={board.notStarted} isAdmin={ctx.isAdmin} adminName={admin?.name ?? "An admin"} />
      </div>
    );
  }

  const items = board.items;
  const done = items.filter((i) => !OPEN.has(i.status) && i.status !== "missed").length;
  const nothingTicked = items.every((i) => !i.doneAt && !i.outcome);
  const disputes = items.filter((i) => i.dispute);
  const myOpen = items.filter((i) => i.userId === ctx.userId && OPEN.has(i.status));
  const theirOpen = items.filter((i) => i.userId !== ctx.userId && OPEN.has(i.status));
  const people = ctx.members
    .map((m) => ({ ...m, items: items.filter((i) => i.userId === m.userId) }))
    .filter((p) => p.items.length > 0);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow={`This week · ${weekRange(board.week.startsAt, board.week.endsAt, rules.timezone)}`}
        title="The board"
        action={
          <div className="flex flex-wrap gap-2">
            {me.swapTokens > 0 ? (
              <SwapSheet
                mine={myOpen.map((i) => ({ id: i.id, name: i.name }))}
                theirs={theirOpen.map((i) => ({ id: i.id, name: i.name, owner: names.get(i.userId) ?? "" }))}
              />
            ) : null}
            {ctx.isAdmin && nothingTicked ? <DealButton started /> : null}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: "Done", value: `${done} of ${items.length}` },
          { label: "Being checked", value: items.filter((i) => i.status === "checking").length },
          { label: "Overdue", value: items.filter((i) => i.status === "overdue").length, hazard: true },
          { label: "Disputed", value: disputes.length, hazard: true },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="eyebrow">{s.label}</div>
            <div className={`mt-0.5 text-2xl font-black tabular ${s.hazard && s.value ? "text-hazard" : ""}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Laptop: the whole house on one board. */}
        <section className="hidden overflow-hidden rounded-lg border border-border bg-card lg:block" aria-label="Every Johh this week">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-foreground text-left">
                <th className="w-3 p-0" aria-label="Kind" />
                <th className="eyebrow px-3 py-2.5">Johh</th>
                <th className="eyebrow px-3 py-2.5">Who</th>
                <th className="eyebrow px-3 py-2.5">Due</th>
                <th className="eyebrow px-3 py-2.5 text-right">Pts</th>
                <th className="eyebrow px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const mine = i.userId === ctx.userId;
                const hazard = i.status === "overdue" || i.status === "missed";
                return (
                  <tr key={i.id} className="border-b border-border last:border-0">
                    <td className="p-0">
                      <span
                        aria-hidden
                        className={`block h-11 w-2 ${hazard ? "hazard-tape" : ""}`}
                        style={hazard ? undefined : { background: lidColor(i.category) }}
                      />
                    </td>
                    <td className="px-3 py-2 font-bold">{i.name}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <Avatar name={names.get(i.userId) ?? "?"} me={mine} className="size-6 text-[10px]" />
                        {mine ? "You" : firstName(names.get(i.userId) ?? "")}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular">
                      {dueLabel(i.dueAt, now, rules.timezone)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular">
                      {OPEN.has(i.status) ? i.points : pointsEarned(i.status, i.points)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusChip status={i.status} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {mine && OPEN.has(i.status) ? (
                        <MarkDone assignmentId={i.id} houseId={ctx.house.id} needsPhoto={i.needsPhoto} compact />
                      ) : !mine && i.status === "checking" ? (
                        <DisputeButton assignmentId={i.id} johh={i.name} owner={names.get(i.userId) ?? ""} />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Phone: one section per housemate, cards you can act on. */}
        <div className="flex flex-col gap-6 lg:hidden">
          {people.map((p) => (
            <section key={p.userId} className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2.5">
                <Avatar name={p.name} me={p.userId === ctx.userId} />
                <span className="text-base font-extrabold">{p.userId === ctx.userId ? "You" : p.name}</span>
                <span className="ml-auto text-sm text-muted-foreground tabular">
                  {p.items.filter((i) => !OPEN.has(i.status)).length}/{p.items.length}
                </span>
              </h2>
              {p.items.map((i) => (
                <JohhCard
                  key={i.id}
                  item={i}
                  ownerName={p.name}
                  mine={p.userId === ctx.userId}
                  houseId={ctx.house.id}
                  zone={rules.timezone}
                  now={now}
                  immunityTokens={p.userId === ctx.userId ? me.immunityTokens : 0}
                />
              ))}
            </section>
          ))}
        </div>

        <aside className="flex flex-col gap-4">
          {disputes.length > 0 ? (
            // On a phone the cards above carry their own vote buttons.
            <section className="hidden rounded-lg border border-border bg-card p-4 lg:block">
              <h2 className="eyebrow mb-3">Disputes</h2>
              <ul className="flex flex-col gap-4">
                {disputes.map((i) => (
                  <li key={i.id} className="flex flex-col gap-2 border-t border-border pt-3 first:border-0 first:pt-0">
                    <p className="text-sm">
                      <span className="font-bold">{i.userId === ctx.userId ? "Your" : `${firstName(names.get(i.userId) ?? "")}'s`}</span>{" "}
                      {i.name}: &ldquo;{i.dispute!.reason}&rdquo;
                    </p>
                    <p className="text-xs text-muted-foreground tabular">
                      {i.dispute!.uphold} not done · {i.dispute!.reject} fine · closes {relative(i.dispute!.closesAt, now)}
                    </p>
                    {i.userId !== ctx.userId ? <VoteButtons disputeId={i.dispute!.id} myVote={i.dispute!.myVote} /> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="eyebrow mb-3">The Table · this week</h2>
            <Standings rows={board.table} names={names} me={ctx.userId} dense />
          </section>
        </aside>
      </div>
    </div>
  );
}
