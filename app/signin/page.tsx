import { safeNext, signInReason } from "@app/core";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { Wordmark } from "@/components/brand/wordmark";
import { getUser } from "@/lib/data/house";

export const metadata: Metadata = { title: "Sign in" };

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
        <h1 className="text-2xl font-black tracking-tight uppercase">Sign in</h1>
        <p className="mt-1 text-muted-foreground">{signInReason(next)}</p>
      </div>
      {params.error ? (
        <p role="alert" className="rounded-md bg-hazard/10 p-3 text-sm font-bold text-hazard">
          Google didn&rsquo;t finish signing you in. Try again.
        </p>
      ) : null}
      <GoogleSignIn next={next === "/" ? "/today" : next} />
      <p className="text-xs text-muted-foreground">
        By signing in you agree to the house rules your housemates set. <Link href="/privacy" className="underline">Privacy</Link>
      </p>
    </main>
  );
}
