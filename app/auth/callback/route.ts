import { safeNext } from "@app/core";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** OAuth callback: exchanges Google's PKCE code for a session, then goes on. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/signin?error=auth`);
}
