// What production is, in one place. `npm run provision` makes the accounts
// match it; nothing here is a secret.
export const CONFIG = {
  app: "Jonz",
  domain: "jonz.app",
  supabase: {
    name: "Johns",
    orgId: "qfabnyoyejsscqklyrmx",
    region: "eu-west-2",
    // The smallest compute a paid organisation can choose.
    size: "micro",
  },
  vercel: {
    project: "jonz-api",
    teamId: "team_efHn4CGsL2iT0Xmp3qdWG9d2",
    // Where the Next app lives in the workspace. Set by hand in the
    // project's settings (Build and Deployment); provision only checks it.
    rootDirectory: "apps/api",
    // apps/api's own name. `domain` belongs to the web build, which passes
    // /api/* on to this name (apps/client/vercel.json), so the clock's URL
    // and the app's calls stay on `domain`.
    domain: "api.jonz.app",
  },
  // The Expo app's web build, which serves `domain` (Phase 13 of
  // docs/specs/native-migration.md). Created by hand, in the same team;
  // provision checks it and gives it its public environment.
  web: {
    project: "jonz-web",
    rootDirectory: "apps/client",
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
  // Staging (`node scripts/staging.mjs`, DEPLOYMENT.md "Staging"): a
  // persistent Supabase branch of the project above, built from the git
  // branch of the same name, which both Vercel projects deploy as a preview
  // under these names. Every other preview shares its database. `previews`
  // is the web build's preview addresses, `*` one DNS label (apps/api's
  // lib/cors.ts).
  staging: {
    branch: "staging",
    domain: "staging.jonz.app",
    apiDomain: "api.staging.jonz.app",
    previews: "https://*-glynfincks-projects.vercel.app",
  },
  // The names supabase/migrations/*_tick_schedule.sql reads.
  vault: { url: "johns_tick_url", secret: "johns_tick_secret" },
  cronJob: "johns-tick",
  local: { appPort: 3205, apiPort: 54341 },
};
