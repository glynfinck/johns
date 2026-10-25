import { randomUUID } from "node:crypto";

import type { BrowserContext } from "@playwright/test";
import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = "http://localhost:3205";

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error(
    "E2E needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and " +
      "SUPABASE_SERVICE_ROLE_KEY in apps/api/.env.local (run `supabase start`).",
  );
}

/** Local-only, and never a real credential: these users exist for one run. */
const PASSWORD = "e2e-not-a-secret-password";

export function admin() {
  return createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Put a signed-in housemate into `context`.
 *
 * Sign-in is Google-only and a consent screen cannot be driven from CI, so
 * the session is minted out of band: a confirmed user from the admin API,
 * real tokens from a password sign-in, and the cookies handed to the
 * browser. @supabase/ssr serializes them against an in-memory jar, so their
 * names and encoding always match what the app reads back.
 */
export async function signInAs(context: BrowserContext, name: string): Promise<string> {
  const email = `e2e-${randomUUID()}@test.local`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error) throw error;

  const jar = new Map<string, string>();
  const client = createBrowserClient(SUPABASE_URL!, ANON_KEY!, {
    isSingleton: false,
    cookies: {
      getAll: () => [...jar].map(([cookieName, value]) => ({ name: cookieName, value })),
      setAll: (cookies) => {
        for (const { name: cookieName, value } of cookies) jar.set(cookieName, value);
      },
    },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  await context.addCookies([...jar].map(([cookieName, value]) => ({ name: cookieName, value, url: BASE_URL })));
  return data.user.id;
}

/** Scoped teardown: the houses these users made, then the users. */
export async function cleanUp(userIds: string[]) {
  const db = admin();
  await db.from("houses").delete().in("created_by", userIds);
  for (const id of userIds) await db.auth.admin.deleteUser(id);
}
