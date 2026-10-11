import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * The service-role client. It bypasses RLS, so it is for the engine
 * (lib/engine) and nothing that a request can steer: every caller decides
 * which house it is working on from a row it has already read through the
 * user's own session, or from the cron tick.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AdminClient = ReturnType<typeof createAdminClient>;
