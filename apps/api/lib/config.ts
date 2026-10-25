import { BIN_NIGHT } from "@app/core";

export { APP_NAME, TAGLINE } from "@app/core";

/** Absolute origin, for metadata and links that leave the app (join links). */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3205";

/** Theme colours for the browser chrome, matching --background. */
export const GROUND = { light: BIN_NIGHT.light.background, dark: BIN_NIGHT.dark.background } as const;

/** Public half of the Web Push key pair. Without it, reminders are simply not offered. */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
