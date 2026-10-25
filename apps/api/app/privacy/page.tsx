import { PAGE_TITLE, PRIVACY_COPY } from "@app/core";
import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";

export const metadata: Metadata = { title: PAGE_TITLE.privacy };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <Link href="/">
        <Wordmark className="text-2xl" />
      </Link>
      <h1 className="mt-8 text-3xl font-black tracking-tight uppercase">{PRIVACY_COPY.title}</h1>
      <div className="mt-4 flex flex-col gap-4 text-[15px] leading-relaxed">
        {PRIVACY_COPY.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    </main>
  );
}
