import { PAGE_TITLE, safeNext, SIGN_IN_COPY, signInReason } from "@app/core";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { Wordmark } from "@/components/brand/wordmark";
import { getUser } from "@/lib/data/house";

export const metadata: Metadata = { title: PAGE_TITLE.signIn };

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const { user } = await getUser();
  if (user) redirect(next === "/" ? "/today" : next);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-12">
      <Link href="/" className="self-start">
        <Wordmark className="text-4xl" />
      </Link>
      <div>
        <h1 className="text-2xl font-black tracking-tight uppercase">{SIGN_IN_COPY.heading}</h1>
        <p className="mt-1 text-muted-foreground">{signInReason(next)}</p>
      </div>
      {params.error ? (
        <p role="alert" className="rounded-md bg-hazard/10 p-3 text-sm font-bold text-hazard">
          {SIGN_IN_COPY.failed("Google")}
        </p>
      ) : null}
      <GoogleSignIn next={next === "/" ? "/today" : next} />
      <p className="text-xs text-muted-foreground">
        {SIGN_IN_COPY.terms}{" "}
        <Link href="/privacy" className="underline">
          {SIGN_IN_COPY.privacy}
        </Link>
      </p>
    </main>
  );
}
