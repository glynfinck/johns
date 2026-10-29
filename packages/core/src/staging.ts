// Staging: the copy of Jonz at staging.jonz.app, on its own database with a
// demo house (supabase/seeds/staging.sql) that nobody real lives in. The
// demo housemates sign in with a password the house owner picks
// (DEPLOYMENT.md, "Staging"), so one person can be all four at once.

/** The demo house's housemates, admin first. The seed makes exactly these. */
export const DEMO_HOUSEMATES = [
  { name: "Alex", email: "alex@demo.jonz.app" },
  { name: "Sam", email: "sam@demo.jonz.app" },
  { name: "Priya", email: "priya@demo.jonz.app" },
  { name: "Jo", email: "jo@demo.jonz.app" },
] as const;

export type DemoHousemate = (typeof DEMO_HOUSEMATES)[number];

/** The words only staging shows. */
export const STAGING_COPY = {
  ribbon: "Staging: demo data, not jonz.app",
  demoLabel: "Staging",
  demoBody: "Sign in as one of the demo house’s housemates.",
  password: "Staging password",
  passwordHint: "The one you set for staging. This browser keeps it.",
  as: (name: string) => `Sign in as ${name}`,
  busy: "Signing in…",
  failed: "That password didn’t work for the demo house.",
} as const;
