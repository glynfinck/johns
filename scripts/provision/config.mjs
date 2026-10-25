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
    // Where the Next app lives in the workspace. Set by hand in the
    // project's settings (Build and Deployment); provision only checks it.
    rootDirectory: "apps/api",
  },
  // Google's native clients for the Expo app (public IDs, from Google Cloud;
  // DEPLOYMENT.md says how to make them). One Android client per signing
  // key: the development builds' and, later, the store's. The web client's ID
  // and secret come from the environment. Supabase accepts tokens for any of
  // them, the web's listed first, and skips its nonce check only once iOS
  // exists, because Google's iOS sign-in signs a nonce the app never sees.
  google: {
    iosClientId: null,
    androidClientIds: [],
  },
  // The names supabase/migrations/*_tick_schedule.sql reads.
  vault: { url: "johns_tick_url", secret: "johns_tick_secret" },
  cronJob: "johns-tick",
  local: { appPort: 3205, apiPort: 54341 },
};
