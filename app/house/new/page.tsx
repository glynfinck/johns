import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand/wordmark";
import { CreateHouseForm } from "@/components/house/create-house-form";
import { getMembership } from "@/lib/data/house";
import { currencyForCountry } from "@/lib/money";

export const metadata: Metadata = { title: "Set up your house" };

/**
 * Where someone with no house lands. The time zone and currency start from
 * wherever they are (Vercel's geo headers), never from the server's region.
 */
export default async function NewHousePage() {
  const { user, houseId } = await getMembership();
  if (!user) redirect("/signin?next=/house/new");
  if (houseId) redirect("/today");

  const h = await headers();
  const zone = h.get("x-vercel-ip-timezone") ?? "Europe/London";

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-12">
      <Wordmark className="self-start text-2xl" />
      <div>
        <h1 className="text-3xl font-black tracking-tight uppercase">Set up your house</h1>
        <p className="mt-2 text-muted-foreground">
          You&rsquo;ll be its admin. Next you add the Johhs and send the house a join link.
        </p>
      </div>
      <section className="rounded-lg border border-border bg-card p-5">
        <CreateHouseForm timezone={zone} currency={currencyForCountry(h.get("x-vercel-ip-country"))} />
      </section>
      <p className="text-sm text-muted-foreground">
        Joining a housemate&rsquo;s house instead? Open the join link they sent you.
      </p>
    </main>
  );
}
