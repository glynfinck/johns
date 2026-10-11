export const APP_NAME = "Johhs";
export const TAGLINE = "The house rota that keeps everyone honest.";

/** Absolute origin, for metadata and links that leave the app (join links). */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3205";

/** Theme colours for the browser chrome, matching --background. */
export const GROUND = { light: "#e7e9e5", dark: "#111315" } as const;

/** Public half of the Web Push key pair. Without it, reminders are simply not offered. */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
