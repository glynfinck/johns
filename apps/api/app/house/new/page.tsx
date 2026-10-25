import { currencyForCountry, NEW_HOUSE_COPY, PAGE_TITLE } from "@app/core";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand/wordmark";
import { CreateHouseForm } from "@/components/house/create-house-form";
import { getMembership } from "@/lib/data/house";

export const metadata: Metadata = { title: PAGE_TITLE.newHouse };

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
        <h1 className="text-3xl font-black tracking-tight uppercase">{NEW_HOUSE_COPY.heading}</h1>
        <p className="mt-2 text-muted-foreground">{NEW_HOUSE_COPY.intro}</p>
      </div>
      <section className="rounded-lg border border-border bg-card p-5">
        <CreateHouseForm timezone={zone} currency={currencyForCountry(h.get("x-vercel-ip-country"))} />
      </section>
      <p className="text-sm text-muted-foreground">{NEW_HOUSE_COPY.joinInstead}</p>
    </main>
  );
}
