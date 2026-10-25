import { NOT_FOUND_COPY } from "@app/core";
import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 px-5 py-12">
      <Wordmark className="self-start text-3xl" />
      <h1 className="text-2xl font-black uppercase">{NOT_FOUND_COPY.title}</h1>
      <p className="text-muted-foreground">{NOT_FOUND_COPY.body}</p>
      <Button asChild className="self-start">
        <Link href="/">{NOT_FOUND_COPY.back}</Link>
      </Button>
    </main>
  );
}
