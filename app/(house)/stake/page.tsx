import { ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/app-shell";
import { ConfirmReceived } from "@/components/stake/confirm-received";
import { Avatar } from "@/components/ui/avatar";
import { nameOf, requireHouse } from "@/lib/data/house";
import { getStake } from "@/lib/data/stake";
import { monthLabel } from "@/lib/format";
import { formatMoney, formatSigned } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "The Stake" };

const KIND_LABEL: Record<string, string> = {
  forfeit: "Forfeit",
  cap_refund: "Over the stake, returned",
  share: "Share of the month's forfeits",
  payment: "Payment",
};

export default async function StakePage() {
  const ctx = await requireHouse();
  const stake = await getStake(ctx);
  const { rules } = ctx;
  const money = (n: number) => formatMoney(n, rules.currency);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow={`${money(stake.stakeMinor)} each, every month`} title="The Stake" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="eyebrow">{monthLabel(stake.month)} so far</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Late costs {money(rules.lateForfeitMinor)}, missed costs {money(rules.missedForfeitMinor)}, and nobody
            loses more than their stake. What&rsquo;s forfeited is shared among everyone else when the month ends.
          </p>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b-2 border-foreground text-left">
                <th className="eyebrow py-2">Housemate</th>
                <th className="eyebrow py-2 text-right">Forfeited</th>
                <th className="eyebrow py-2 text-right">Share</th>
                <th className="eyebrow py-2 text-right">If it ended now</th>
              </tr>
            </thead>
            <tbody>
              {stake.projection.map((p) => (
                <tr key={p.userId} className="border-b border-border last:border-0">
                  <td className="py-2.5">
                    <span className="inline-flex items-center gap-2 font-bold">
                      <Avatar name={ctx.members.find((m) => m.userId === p.userId)?.name ?? "?"} me={p.userId === ctx.userId} className="size-6 text-[10px]" />
                      {nameOf(ctx, p.userId)}
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular">
                    {p.forfeited ? money(p.forfeited) : "–"}
                    {p.forfeitedRaw > p.forfeited ? <span className="block text-xs text-muted-foreground">capped</span> : null}
                  </td>
                  <td className="py-2.5 text-right tabular">{p.received ? money(p.received) : "–"}</td>
                  <td className={cn("py-2.5 text-right font-black tabular", p.net < 0 && "text-hazard", p.net > 0 && "text-good")}>
                    {formatSigned(p.net, rules.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="eyebrow">Settle up</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            From closed months. Pay however the house pays each other, then whoever was paid marks it received.
          </p>
          {stake.transfers.length === 0 ? (
            <p className="rounded-md bg-secondary p-4 text-sm font-bold">Everyone&rsquo;s square.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {stake.transfers.map((t) => (
                <li key={`${t.from}-${t.to}`} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
                  <span className="font-bold">{nameOf(ctx, t.from)}</span>
                  <ArrowRightIcon className="size-4 text-muted-foreground" aria-label="pays" />
                  <span className="font-bold">{nameOf(ctx, t.to)}</span>
                  <span className="ml-auto text-lg font-black tabular">{money(t.amount)}</span>
                  {t.to === ctx.userId ? (
                    <ConfirmReceived houseId={ctx.house.id} fromUserId={t.from} amount={t.amount} label="Mark received" />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h2 className="eyebrow mb-3">The ledger</h2>
          {stake.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet. Forfeits appear as Johns are settled.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b-2 border-foreground text-left">
                    <th className="eyebrow py-2">Month</th>
                    <th className="eyebrow py-2">Who</th>
                    <th className="eyebrow py-2">What</th>
                    <th className="eyebrow py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {stake.history.map((h) => (
                    <tr key={h.id} className="border-b border-border last:border-0">
                      <td className="py-2 text-muted-foreground tabular">{h.month}</td>
                      <td className="py-2 font-bold">{nameOf(ctx, h.userId)}</td>
                      <td className="py-2">
                        {KIND_LABEL[h.kind] ?? h.kind}
                        {h.kind === "payment" && h.counterparty ? (
                          <span className="text-muted-foreground">
                            {" "}
                            {h.amount > 0 ? "to" : "from"} {nameOf(ctx, h.counterparty)}
                          </span>
                        ) : null}
                      </td>
                      <td className={cn("py-2 text-right font-bold tabular", h.amount < 0 ? "text-hazard" : "text-good")}>
                        {formatSigned(h.amount, rules.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
