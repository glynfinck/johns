# Deploying Jonz

The same arrangement as Pub Golf: Vercel's git integration builds the apps
(the Next.js workspace in `apps/api` as the `jonz-api` project, and from the
cutover below the Expo app's web build in `apps/client` as `jonz-web`;
they were `johns` and `johns-web` until the move to jonz.app below),
Supabase's GitHub integration applies the migrations, and CI only proves.
`main` is production. There is no preview database yet, so preview
deployments get no keys (a preview writing to production's data would be
worse than one that doesn't start); add a persistent `preview` branch project
when the house wants a staging copy.

Because the two integrations do not wait for each other, migrations must be
additive and readable by the code already deployed.

## Setting up production: `npm run provision`

Production is described in `scripts/provision/config.mjs` (project names,
region, domain, Vercel team) and one command makes the accounts match it,
then checks that they do. Run it on your own machine: it needs tokens this
repo must never hold, and every secret it generates goes straight to where
it is used without being printed.

```sh
# .env.provision.local (gitignored), or the environment:
SUPABASE_ACCESS_TOKEN=…   # supabase.com/dashboard/account/tokens
VERCEL_TOKEN=…            # vercel.com/account/settings/tokens

npm run provision                 # do what's missing, then check everything
npm run provision -- --check      # change nothing; read back and check
npm run provision -- --no-deploy  # skip the production deploy at the end
```

It is safe to run again and again: each step looks before it writes.

**From a phone, run it on GitHub instead.** The **Provision production**
workflow (`.github/workflows/provision.yml`) runs the same command on a
runner, with the tokens as repository secrets (`SUPABASE_ACCESS_TOKEN`,
`VERCEL_TOKEN`, later `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`). Start it
from the Actions tab: <https://github.com/glynfinck/johns/actions/workflows/provision.yml>
→ Run workflow. Its summary page lists every check and what's left, each step
a link and each value to paste on its own line. A database password made by a
workflow run lives only for that run, which is enough: everything after
creating the project goes through the Management API, and the dashboard can
reset the password if you ever need a direct connection.

| Step | What it does | How it checks |
| --- | --- | --- |
| Supabase project | Creates `Johns` in London at the smallest compute (Micro) if it doesn't exist, saving the database password to `.env.provision.local` first, and waits for it to be healthy | Finds it by name |
| Migrations | Pushes any `supabase/migrations` the database hasn't recorded (`supabase db push`, with the saved password) | Compares versions both ways |
| The clock | Writes the two Vault secrets `request_tick()` reads. The tick secret is reused if it exists, so it never drifts from Vercel's `CRON_SECRET` | Reads both back; finds the `johns-tick` pg_cron job |
| Sign-in | Sets only production's auth fields through the Management API: site URL, redirect URLs, email sign-up off, and Google once its client is given, with the app's iOS and Android clients from `config.mjs` listed after it (nonce check skipped only once there is an iOS client) | Reads them back and refuses an unresolved `env(...)` client ID, a different client list or nonce setting |
| Vercel | Upserts the production environment (Supabase URL and keys, site URL, `CRON_SECRET`, VAPID keys, made once and then kept, since new ones would orphan every subscribed phone) and deploys `main` | Reads the variables back; checks the project builds from `apps/api` (its Root Directory, which it never sets: that one is by hand) and that its own name, `api.jonz.app`, is attached and verified; waits for the deploy |
| The web build | Upserts `jonz-web`'s production environment (public values only: Supabase's URL and anon key, and the VAPID public key read back from `jonz-api`) and deploys `main` | Finds the project (made by hand, never by provision); checks it builds from `apps/client`, reads the variables back, and that `jonz.app` is attached to it and verified; waits for the deploy |
| End to end | | `/signin` answers; the clock's tick, sent to `jonz.app` and passed on to `apps/api`, is accepted (so Vercel and the Vault share one secret); Supabase sends sign-in to Google with this client and back to `/signin`, and Google doesn't refuse it |

It never runs `supabase config push`. That would write `config.toml`'s
localhost over the production site URL and turn email sign-up back on, which
is exactly what local development needs and production must not have.

### What stays manual, and why

- **The Google sign-in client.** Google has no API for creating sign-in
  clients or for the consent screen's branding. The first run prints exactly
  what to paste where (a Cloud project for Johns, its branding page with the
  home page and privacy URLs, and a Web client with these redirect URIs); run
  it again with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set and it
  configures Supabase, writes the same client into `supabase/.env.local` for
  local sign-in, and checks the round trip. The secret itself is only proved by a
  real sign-in: Google checks it when it exchanges the code, after the user
  has chosen an account.
- **Google's clients for the app** (iOS and Android). The Expo app signs in
  with Google's own sheet, which hands Supabase an ID token, so it needs
  clients of its own beside the web one, in the same Cloud project
  ([Clients → Create client](https://console.cloud.google.com/auth/clients/create)):
  1. **iOS**: bundle ID `dev.glyn.jonz` (the Team ID once the Apple
     account exists). Its client ID goes in `scripts/provision/config.mjs`
     (`google.iosClientId`) and in `apps/client/.env.local` as
     `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, which also gives the iOS build its
     URL scheme (`app.config.ts`).
  2. **Android**: package `dev.glyn.jonz` and the SHA-1 of the key the
     build is signed with. One client per key: the development builds' now,
     the store's later. Development builds use React Native's shared debug
     key, whose SHA-1 is
     `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` (read
     from a prebuild on 25 October 2026; `keytool -list -v -keystore
     apps/client/android/app/debug.keystore -alias androiddebugkey
     -storepass android` shows it after `npx expo run:android`). Their IDs go
     in `google.androidClientIds`.
  3. The **web** client's ID goes in `apps/client/.env.local` as
     `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: on Android it is the token's
     audience.

  None of these IDs is a secret. Provision then lists them all in Supabase
  (web first), and turns on "Skip nonce check" once the iOS client is
  there: Google's iOS sign-in signs a nonce the app never sees, and
  Supabase's guide says to skip the check for it. That weakens replay
  protection for Google tokens, which is why it waits for iOS.
- **Sign in with Apple** (iOS only), once there is an Apple Developer
  account: turn on the capability for the App ID `dev.glyn.jonz`, then the
  Apple provider in Supabase with `dev.glyn.jonz` as its client ID. The
  app's sign-in is native, so it needs no secret key. It can't be tried on a
  device before then.
- **The Supabase GitHub integration**, so that migrations apply on merge:
  one click in the project's settings, with no API. Its **working
  directory** is `.` (the folder that contains `supabase/`, not `supabase`
  itself), the production branch `main`, with "deploy to production" on and
  automatic branching off. It deploys on every push to `main`, applying any
  new migrations; Auth and API settings in `config.toml` are ignored, which
  is what keeps them local.
- **Claude, for "Describe your house"** (optional). `POST /api/setup/draft`
  asks Claude (`claude-haiku-5-5`, `apps/api/lib/ai/house-draft.ts`) to
  draft a new house's John list. It needs an Anthropic API key, made at
  [platform.claude.com](https://platform.claude.com/settings/keys) under a
  workspace with a monthly spend limit, added to the `jonz-api` project's
  production environment as `ANTHROPIC_API_KEY` (server only, never in
  `jonz-web` or the app), then a redeploy. Provision doesn't manage it and
  never removes it. Without it, setup offers the starter lists instead, so
  nothing breaks. A draft costs well under a cent, and each house gets ten
  a day (`DRAFTS_PER_DAY`), counted in `house_drafts`.
- **Brand verification.** Opening the app beyond your own house means
  Google's review; the landing page at `/` carries the name, the purpose and
  the privacy link it checks for.

Already done (October 2026): the Vercel project `johns` exists, deploys
`glynfinck/johns`, runs its functions in London next to the database, and
has `johns.glyn.dev` attached. glyn.dev's DNS is on Vercel, so the domain
needed no record.

The Supabase project `Johns` (ref `mmnmffdpdzrncvwzgjhq`) was created by hand
on 25 October 2026 in London (`eu-west-2`) at the smallest size, so
provision finds it by name and never creates one. Its GitHub integration is
connected as above. Because provision has no database password for it, it
never pushes migrations itself: they arrive through the integration.

The project's **Root Directory** is `apps/api` (Settings → Build and
Deployment), where the Next app moved in Phase 2 of
`docs/specs/native-migration.md`. Vercel installs the whole npm workspace from
the repository root and builds that directory. Changing the setting doesn't
redeploy anything, and a build from the wrong directory fails without
replacing the live deployment, which keeps serving.

## The web build and the cutover (Phase 13)

From the cutover, johns.glyn.dev is the Expo app's web build, in a second
Vercel project, `johns-web` (Root Directory `apps/client`, framework
"Other"). `apps/client/vercel.json` says the rest: it builds with `npm run
export:web` into `dist`, opens every path that isn't a file on the app
(which draws its own not-found), sends the Next app's security headers, and
passes `/api/*` on to `apps/api`, which answers on a name of its own,
`api.johns.glyn.dev`. So:

- **The clock doesn't move.** The Vault's tick URL stays
  `https://johns.glyn.dev/api/cron/tick`; the web project passes it on, with
  its secret, to the same route.
- **The browser needs no CORS**, and no secret moves: the web build calls
  `/api/*` on its own origin, and its environment is public (Supabase's URL
  and the anon key `apps/api` uses, and the VAPID public key `apps/api`
  signs with, copied from `johns`, never made anew).
- **Reminders and installs carry over**: `/sw.js`, the manifest and the
  icons sit at the same paths, and the VAPID key is the same, so phones
  already subscribed keep getting reminders.
- **Sign-in needs no change**: Supabase's site URL stays
  `https://johns.glyn.dev` and its redirect URLs already allow
  `https://johns.glyn.dev/**`, which covers `/signin`, where the web build
  comes back to; Google only ever sees Supabase's callback.
- **Everyone signs in once more** on the web, because the session moves
  from cookies to the browser's storage.

The steps, each asked for and checked before the next:

1. **Give `apps/api` its own name**: attach `api.johns.glyn.dev` to `johns`
   (glyn.dev's DNS is on Vercel, so no record). Check that
   `https://api.johns.glyn.dev/api/cron/tick` refuses a request without the
   secret (401): it's the same deployment as johns.glyn.dev.
2. **Make `johns-web`**: import `glynfinck/johns`, Root Directory
   `apps/client`, framework Other, Node 24, the same team. Its production
   environment is the three `EXPO_PUBLIC_` values above; previews get
   nothing, as for `johns`. Deploy `main`.
3. **Check it on its own `.vercel.app` URL**, before it has the domain: the
   front door, privacy and a link to nowhere; `/manifest.webmanifest` and
   `/sw.js`; `POST /api/fresh` with no token answers the API's own 401
   (the rewrite reaches `apps/api`), and so does the tick without its secret.
   Signing in there needs that URL in Supabase's redirect URLs for the
   check, and taken out after (provision writes only johns.glyn.dev's back).
4. **Move `johns.glyn.dev`** from `johns` to `johns-web`.
5. **Check production**: sign in with Google on johns.glyn.dev, open the
   house, tick a John, see it on the Wall, turn reminders on; the clock's
   next tick shows 200 (`select * from cron.job_run_details order by
   start_time desc limit 5;`, and `/api/cron/tick` in `johns`'s logs); a
   reminder arrives.

**Rolling back** is step 4 in reverse: move `johns.glyn.dev` back to
`johns`, whose pages still answer. Once Phase 14 has removed them, roll back
by promoting `johns`'s last deployment that still had them (Vercel keeps
every deployment) and moving the domain back.

## The move to jonz.app (October 2026)

The app is called Jonz and lives at jonz.app; it was Johns at
johns.glyn.dev. Only the brand moved: the repo, the Supabase project `Johns`,
the database, the Vault names (`johns_tick_url`, `johns_tick_secret`), the
cron job `johns-tick` and the chores themselves keep "Johns". The section
above is the cutover as it happened, under the old names.

In order, each checked before the next:

1. **The new names answer.** jonz.app and www.jonz.app (forwarding to
   jonz.app) on the web project, api.jonz.app on the API project, both over
   HTTPS, and `https://api.jonz.app/api/cron/tick` refuses a request without
   the secret (401). Supabase's redirect URLs gain `https://jonz.app/**`, and
   Google's consent screen is renamed Jonz with jonz.app authorised.
2. **The code moves** in one PR: the name, the app's ids (`dev.glyn.jonz`,
   scheme `jonz`), `SITE_URL`, the web build's `/api` rewrite to
   api.jonz.app, and `scripts/provision/config.mjs`. The web project starts
   calling api.jonz.app the moment it deploys, which is why step 1 comes
   first. Rename the Vercel projects to `jonz-web` and `jonz-api` in the same
   hour: provision finds them by name.
3. **The switch-over.** The Vault's `johns_tick_url` becomes
   `https://jonz.app/api/cron/tick` and Supabase's site URL
   `https://jonz.app`. Running `npm run provision` after step 2 writes both
   (and the site URL and VAPID subject in Vercel), so don't run it until this
   step is wanted. Then johns.glyn.dev and api.johns.glyn.dev forward (308,
   path kept) to the new names.
4. **Tell the house.** A browser keeps sign-in, the home-screen install and
   reminders per address, so everyone signs in again on jonz.app, re-adds it
   to the home screen and turns reminders back on.

Rolling back before step 3 is reverting the PR; the old names still answer.
After it, take the forwards off in the Vercel dashboard. About three months
on, remove the old names and their Supabase redirect URLs.

## Day to day

- Work on a branch, open a PR; CI must be green to merge.
- Merging to `main` deploys both halves. A migration that drops or renames
  anything the running code reads is an outage for the minute the deploys
  take; split it into an additive step and a later cleanup.
- `npm run provision -- --check` says whether production still looks right.
- `TICK_URL=https://jonz.app/api/cron/tick CRON_SECRET=… npm run tick`
  runs the clock by hand (through the web project's rewrite;
  `https://api.jonz.app/api/cron/tick` goes straight there). Check the cron job with
  `select * from cron.job_run_details order by start_time desc limit 5;`.
