import Link from "next/link";

import { DealButton } from "@/components/house/start-rota";
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
        <h2 className="text-lg font-extrabold">Nothing&rsquo;s on the rota this week.</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every John on the list is on a fortnightly or longer cycle, or the list is empty.
        </p>
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
      <h2 className="text-lg font-extrabold">The rota hasn&rsquo;t started yet.</h2>
      {isAdmin ? (
        <>
          <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm">
            <li>Add the house&rsquo;s Johns, with how much effort each one is.</li>
            <li>Send the join link to everyone who lives there.</li>
            <li>Hand out the first week. Johns are shared so the effort evens out.</li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/house">Set up the house</Link>
            </Button>
            <DealButton started={false} />
          </div>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          {adminName} will hand out the first week once the John list is ready.
        </p>
      )}
    </section>
  );
}
