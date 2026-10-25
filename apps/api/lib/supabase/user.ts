import type { Database } from "@app/core";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * Acts as the person whose access token a request carries, so Row Level
 * Security applies exactly as it does in the app: what the API reads or
 * writes through this, they could have read or written themselves.
 */
export function userClient(accessToken: string) {
  return createClient<Database>(env.supabaseUrl(), env.supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export type UserClient = ReturnType<typeof userClient>;
