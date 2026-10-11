import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand/wordmark";
import { JoinButton } from "@/components/house/join-button";
import { Button } from "@/components/ui/button";
import { signInPath } from "@/lib/auth-paths";
import { getMembership } from "@/lib/data/house";

export const metadata: Metadata = { title: "Join a house", robots: { index: false } };

/**
 * A join link. It shows the house's name only to someone signed in, so a
 * link that escapes the group chat tells a stranger nothing.
 */
export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const { supabase, user, houseId } = await getMembership();
  if (!user) redirect(signInPath(`/join/${code}`));

  const { data } = await supabase.rpc("house_by_code", { p_code: code });
  const house = data?.[0] ?? null;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-12">
      <Wordmark className="self-start text-3xl" />
      {!house ? (
        <>
          <h1 className="text-2xl font-black uppercase">That link doesn&rsquo;t work</h1>
          <p className="text-muted-foreground">Ask whoever sent it for a fresh one from their House screen.</p>
        </>
      ) : houseId === house.id ? (
        <>
          <h1 className="text-2xl font-black uppercase">You&rsquo;re already in {house.name}</h1>
          <Button asChild>
            <Link href="/today">Go to your Johns</Link>
          </Button>
        </>
      ) : houseId ? (
        <>
          <h1 className="text-2xl font-black uppercase">You&rsquo;re in another house</h1>
          <p className="text-muted-foreground">
            Johns keeps you in one house at a time. Leave your current one from its House screen first.
          </p>
          <Button asChild variant="outline">
            <Link href="/house">Your house</Link>
          </Button>
        </>
      ) : (
        <>
          <div>
            <p className="eyebrow">You&rsquo;re invited</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight uppercase">{house.name}</h1>
            <p className="mt-2 text-muted-foreground">
              {house.members} {house.members === 1 ? "person lives" : "people live"}{" "}
              here. Joining puts you on next week&rsquo;s rota.
            </p>
          </div>
          <JoinButton code={code} houseName={house.name} />
        </>
      )}
    </main>
  );
}
