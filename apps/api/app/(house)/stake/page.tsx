import { formatMoney, formatSigned, monthLabel, STAKE_COPY } from "@app/core";
import { ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/app-shell";
import { ConfirmReceived } from "@/components/stake/confirm-received";
import { Avatar } from "@/components/ui/avatar";
import { nameOf, requireHouse } from "@/lib/data/house";
import { getStake } from "@/lib/data/stake";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: STAKE_COPY.title };

export default async function StakePage() {
  const ctx = await requireHouse();
  const stake = await getStake(ctx);
  const { rules } = ctx;
  const money = (n: number) => formatMoney(n, rules.currency);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow={STAKE_COPY.eyebrow(money(stake.stakeMinor))} title={STAKE_COPY.title} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="eyebrow">{STAKE_COPY.soFar(monthLabel(stake.month))}</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            {STAKE_COPY.soFarBody(money(rules.lateForfeitMinor), money(rules.missedForfeitMinor))}
          </p>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-foreground text-left">
                <th className="eyebrow py-2">{STAKE_COPY.columns.who}</th>
                <th className="eyebrow py-2 pl-3 text-right">{STAKE_COPY.columns.forfeited}</th>
                <th className="eyebrow py-2 pl-3 text-right">{STAKE_COPY.columns.share}</th>
                <th className="eyebrow py-2 pl-3 text-right">{STAKE_COPY.columns.ifNow}</th>
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
                  <td className="py-2.5 pl-3 text-right tabular">
                    {p.forfeited ? money(p.forfeited) : "–"}
                    {p.forfeitedRaw > p.forfeited ? <span className="block text-xs text-muted-foreground">{STAKE_COPY.capped}</span> : null}
                  </td>
                  <td className="py-2.5 pl-3 text-right tabular">{p.received ? money(p.received) : "–"}</td>
                  <td className={cn("py-2.5 pl-3 text-right font-black whitespace-nowrap tabular", p.net < 0 && "text-hazard", p.net > 0 && "text-good")}>
                    {formatSigned(p.net, rules.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="eyebrow">{STAKE_COPY.settleUp}</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">{STAKE_COPY.settleBody}</p>
          {stake.transfers.length === 0 ? (
            <p className="rounded-md bg-secondary p-4 text-sm font-bold">{STAKE_COPY.square}</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {stake.transfers.map((t) => (
                <li key={`${t.from}-${t.to}`} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
                  <span className="font-bold">{nameOf(ctx, t.from)}</span>
                  <ArrowRightIcon className="size-4 text-muted-foreground" aria-label={STAKE_COPY.pays} />
                  <span className="font-bold">{nameOf(ctx, t.to)}</span>
                  <span className="ml-auto text-lg font-black tabular">{money(t.amount)}</span>
                  {t.to === ctx.userId ? (
                    <ConfirmReceived houseId={ctx.house.id} fromUserId={t.from} amount={t.amount} label={STAKE_COPY.markReceived} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h2 className="eyebrow mb-3">{STAKE_COPY.ledger}</h2>
          {stake.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{STAKE_COPY.ledgerEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-foreground text-left">
                    <th className="eyebrow py-2">{STAKE_COPY.ledgerColumns.month}</th>
                    <th className="eyebrow py-2">{STAKE_COPY.ledgerColumns.who}</th>
                    <th className="eyebrow py-2">{STAKE_COPY.ledgerColumns.what}</th>
                    <th className="eyebrow py-2 text-right">{STAKE_COPY.ledgerColumns.amount}</th>
                  </tr>
                </thead>
                <tbody>
                  {stake.history.map((h) => (
                    <tr key={h.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-2 text-muted-foreground whitespace-nowrap tabular">{h.month}</td>
                      <td className="py-2 pr-2 font-bold">{nameOf(ctx, h.userId)}</td>
                      <td className="py-2">
                        {STAKE_COPY.kind[h.kind] ?? h.kind}
                        {h.kind === "payment" && h.counterparty ? (
                          <span className="text-muted-foreground">
                            {" "}
                            {STAKE_COPY.counterparty(h.amount, nameOf(ctx, h.counterparty))}
                          </span>
                        ) : null}
                      </td>
                      <td className={cn("py-2 pl-2 text-right font-bold whitespace-nowrap tabular", h.amount < 0 ? "text-hazard" : "text-good")}>
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
