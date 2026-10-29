// What the API's route handlers read from the environment, in one place.
// Values come from .env.local locally and from Vercel's environment when
// deployed. (The engine's service-role key is read by lib/supabase/admin.ts.)

import { originAllowed } from "./cors";

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
   * once the Expo web build serves jonz.app it calls the API from the
   * same origin. On staging, the staging site and its previews, as
   * patterns (lib/cors.ts).
   */
  allowedOrigins: () =>
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  /**
   * The app's own web address (the Expo web build), where Stripe sends a
   * buyer back after Checkout or the billing page: https://jonz.app.
   */
  appUrl: () => required("APP_URL").replace(/\/+$/, ""),
  /**
   * Where to send a browser back to after Stripe: the page that asked, when
   * it's one of ALLOWED_ORIGINS (staging, or a preview of the web build),
   * otherwise APP_URL. Production lists no origins, so it is always APP_URL.
   */
  appUrlFor: (request: Request) => {
    const origin = request.headers.get("origin");
    return originAllowed(origin, env.allowedOrigins()) ? origin : env.appUrl();
  },
  /**
   * Which copy of Jonz this is, from Vercel's own VERCEL_ENV: production, or
   * staging (every preview shares the staging database), or local. Stripe
   * purchases carry it, so each copy's webhook leaves the other's alone.
   */
  stage: (): Stage =>
    process.env.VERCEL_ENV === "production" ? "production" : process.env.VERCEL_ENV === "preview" ? "staging" : "local",
};

export type Stage = "production" | "staging" | "local";
