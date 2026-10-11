import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 px-5 py-12">
      <Wordmark className="self-start text-3xl" />
      <h1 className="text-2xl font-black uppercase">Nothing here</h1>
      <p className="text-muted-foreground">That page isn&rsquo;t on the list.</p>
      <Button asChild className="self-start">
        <Link href="/">Back to your Johns</Link>
      </Button>
    </main>
  );
}
