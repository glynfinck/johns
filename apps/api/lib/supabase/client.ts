"use client";

import type { Database } from "@app/core";
import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client (singleton per tab). */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
