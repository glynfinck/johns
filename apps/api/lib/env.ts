// What the API's route handlers read from the environment, in one place.
// Values come from .env.local locally and from Vercel's environment when
// deployed. (The engine's service-role key is read by lib/supabase/admin.ts.)

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  return value;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  /**
   * Web origins allowed to call /api/* from another origin, comma-separated:
   * the Expo app's web build on 8205 locally. The phones send no Origin, and
   * once the Expo web build serves johns.glyn.dev it calls the API from the
   * same origin.
   */
  allowedOrigins: () =>
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
};
