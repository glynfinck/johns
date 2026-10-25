"use client";

import { ERROR_COPY } from "@app/core";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 px-5 py-12">
      <h1 className="text-2xl font-black uppercase">{ERROR_COPY.title}</h1>
      <p className="text-muted-foreground">{ERROR_COPY.body}</p>
      <Button onClick={reset} className="self-start">
        {ERROR_COPY.retry}
      </Button>
    </main>
  );
}
