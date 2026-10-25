"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 px-5 py-12">
      <h1 className="text-2xl font-black uppercase">Something went wrong</h1>
      <p className="text-muted-foreground">It wasn&rsquo;t you. Try again, and if it keeps happening, tell the house admin.</p>
      <Button onClick={reset} className="self-start">
        Try again
      </Button>
    </main>
  );
}
