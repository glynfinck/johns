import { NOT_DEALT_COPY } from "@app/core";
import Link from "next/link";

import { DealButton } from "@/components/house/deal-button";
import { Button } from "@/components/ui/button";

/** What a house sees before there is anything to do this week. */
export function NotDealt({
  notStarted,
  isAdmin,
  adminName,
}: {
  notStarted: boolean;
  isAdmin: boolean;
  adminName: string;
}) {
  if (!notStarted) {
    return (
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-extrabold">{NOT_DEALT_COPY.nothingThisWeek}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{NOT_DEALT_COPY.nothingThisWeekBody}</p>
        {isAdmin ? (
          <Button asChild variant="outline" className="mt-4">
            <Link href="/house#johns">Edit the John list</Link>
          </Button>
        ) : null}
      </section>
    );
  }
  return (
    <section className="relative overflow-hidden rounded-lg border border-border bg-card p-6">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-hivis" />
      <h2 className="text-lg font-extrabold">{NOT_DEALT_COPY.notYet}</h2>
      {isAdmin ? (
        <>
          <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm">
            {NOT_DEALT_COPY.adminSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/house">Set up the house</Link>
            </Button>
            <DealButton started={false} />
          </div>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{NOT_DEALT_COPY.waitingFor(adminName)}</p>
      )}
    </section>
  );
}
