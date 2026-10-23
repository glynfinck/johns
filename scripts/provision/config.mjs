// What production is, in one place. `npm run provision` makes the accounts
// match it; nothing here is a secret.
export const CONFIG = {
  app: "Johns",
  domain: "johns.glyn.dev",
  supabase: {
    name: "Johns",
    orgId: "qfabnyoyejsscqklyrmx",
    region: "eu-west-2",
    // The smallest compute a paid organisation can choose.
    size: "micro",
  },
  vercel: {
    project: "johns",
    teamId: "team_efHn4CGsL2iT0Xmp3qdWG9d2",
  },
  // The names supabase/migrations/*_tick_schedule.sql reads.
  vault: { url: "johns_tick_url", secret: "johns_tick_secret" },
  cronJob: "johns-tick",
  local: { appPort: 3205, apiPort: 54341 },
};
