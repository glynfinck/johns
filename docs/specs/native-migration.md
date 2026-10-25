# Johns on iOS and Android: migration plan

Status: **approved 25 October 2026**, with the recommended answer to each
question at the end. Written against `johns@e17afac` and
`app-template@f08512d`.

## What this does

Moves Johns onto the shape of `glynfinck/app-template` (an Expo app, a
Next.js API, a shared `@app/core` package and `supabase/`) so the same house
can be run from an iPhone, an Android phone and the web, without
johns.glyn.dev noticing on the way.

What does **not** change, in any phase:

- `supabase/`: RLS and the SECURITY DEFINER functions stay the only
  enforcement. Migrations stay additive. The native app writes through the
  same functions the web does.
- The clock: pg_cron, `request_tick()`, the Vault secrets, `/api/cron/tick`
  and its URL, `CRON_SECRET`.
- Web push: VAPID keys, `/sw.js`, the existing subscriptions.
- Ports: the app on 3205, Supabase on 54340–54344.
- Store releases: `release-targets.json` has `ios` and `android` set to
  `false`, and nothing here switches them on.
- Env var names in production (`NEXT_PUBLIC_SUPABASE_*`,
  `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `VAPID_*`). The template's
  names (`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) would mean
  editing Vercel's environment for no gain, so `apps/api` keeps Johns' names.
  `apps/client` gets new `EXPO_PUBLIC_*` names, which conflict with nothing.

For a Python reader: npm workspaces work like a uv workspace. `@app/core` is
a local package every app installs in editable mode (`pip install -e`), and
its `index.ts` re-exports the modules the way an `__init__.py` with
`from .week import *` would.

## Where it starts and where it ends

| | Johns today | Template | Johns after |
| --- | --- | --- | --- |
| Layout | one Next.js app at the root | `apps/client`, `apps/api`, `packages/core` | the template's layout |
| Pure rules | `lib/*.ts`, `tests/unit` | `packages/core/src` | `packages/core/src`, tests beside each file |
| Next.js | 16.2.10, pages and API | 16.4.3, route handlers only | 16.2.10 (no bump), pages kept until Expo web parity |
| React | 19.2.4 | 19.3.0 (Expo SDK 58) | one version, the Expo SDK's, from Phase 3 |
| Expo | none | SDK 58, RN 0.88 | SDK 58 (newest stable today, 58.0.19) |
| Tests | Vitest (unit, db), Playwright | Jest | Vitest in core and api, jest-expo in client, Playwright |
| Agent rules | `CLAUDE.md` + Next's `AGENTS.md` | `AGENTS.md` only | `AGENTS.md` only |
| Releases | none | `release-targets.json`, `scripts/release.mjs` | the same, both off |

The finished tree:

```
apps/
  api/          Next.js: web UI (until parity), server actions, /api/* routes,
                the engine, push sending, e2e, tests/db         → Vercel "johns"
  client/       Expo: iOS, Android, web                         → EAS later; Vercel at parity
packages/
  core/         @app/core: week, deal, away, outcome, points, streak, stake,
                dispute, money, format, domain, errors, auth-paths, schemas,
                Bin Night tokens, db-types
supabase/       unchanged
scripts/        provision, tick, vapid, release.mjs
docs/specs/     this file, _template.md, one spec per later feature
release-targets.json   { "ios": false, "android": false }
```

### The map, file by file

| Today | After | Phase |
| --- | --- | --- |
| `lib/{week,deal,away,outcome,points,streak,stake,dispute,money,format,domain,errors,auth-paths}.ts` | `packages/core/src/*.ts` | 1 |
| `types/database.ts` | `packages/core/src/db-types.ts` (`npm run types` still writes it) | 1 |
| `tests/unit/*.test.ts` (except provision) | `packages/core/src/*.test.ts`, same names | 1 |
| `tests/unit/provision.test.ts` | `scripts/provision/lib.test.ts`, run by the root `npm test` | 1 |
| `lib/config.ts`, `lib/utils.ts`, `lib/push.ts`, `lib/actions/`, `lib/data/`, `lib/engine/`, `lib/supabase/` | `apps/api/lib/` | 2 |
| `app/`, `components/`, `hooks/`, `public/`, `proxy.ts`, `components.json`, Next/PostCSS/ESLint/TS configs | `apps/api/` | 2 |
| `tests/db/`, `tests/support/`, `e2e/`, `playwright.config.ts`, `vitest.config.mts` (db) | `apps/api/` (the db suite drives the engine, which lives there) | 2 |
| `.env.local`, `.env.example` | `apps/api/` | 2 |
| `CLAUDE.md`, `AGENTS.md` | merged into root, `apps/api` and `apps/client` `AGENTS.md`; `CLAUDE.md` deleted | 2 (client file in 3) |
| zod inputs in `lib/actions/*` | `packages/core/src/schemas.ts`, one screen at a time | 5–11 |
| query shaping in `lib/data/*` | pure builders in core (rows in, view out), used by both apps | 5–11 |

The engine (`lib/engine/tick.ts`) stays in `apps/api`, not core: everything
it does goes through service-role SQL functions, and only a server holds that
key. It keeps taking the client and `now` as arguments, so `tests/db` still
drives it directly.

## What the native app needs a server for

The rule from the brief: `apps/client` calls Supabase directly (rpc, table
writes the column grants allow, Storage, Realtime) and calls `apps/api` only
where a server is genuinely needed. Going through every server action today:

| Move | Web today | Native and Expo web |
| --- | --- | --- |
| `mark_done`, `undo_done`, `use_immunity`, `use_swap`, `confirm_payment`, `set_away`, `cancel_away`, `save_group`, `delete_group`, `set_member_role`, `remove_member`, `create_house`, `join_house` | server action → rpc | **rpc, direct** |
| House settings, the John list, your own name, reactions | server action → table write | **table write, direct** (same column grants) |
| Photo receipt | browser → `proofs` bucket | **Storage, direct** (same policies) |
| Live updates | Realtime on `events`, `assignments`, `disputes` | **Realtime, direct** |
| Default currency and time zone for a new house | Vercel geo headers | device locale (`expo-localization`) through `currencyForCountry` in core |
| Hand out this week's Johns | action runs the engine with the service role | **`POST /api/deal`** |
| Raise a dispute | action: rpc, then pushes to the ticker and voters, then a tick (a house of two decides at once) | **`POST /api/disputes`** |
| Cast a vote | action: rpc, then a tick (a majority decides at once) | **`POST /api/disputes/:id/votes`** |
| Catch the house up before showing it | `ensureFresh` on page load | **`POST /api/fresh`** when a screen gains focus, at most once a minute per house, as now |
| The clock, reminders | pg_cron → `/api/cron/tick` | unchanged |

For the dispute and vote routes, the rpc itself still runs as the caller
(a client built from their bearer token), so the database decides exactly as
it does now; the route only adds what needs the service role. The server
actions and the routes call one shared function in `apps/api/lib/moves/`, so
web and native cannot drift apart. The routes copy the template's helpers
(`requireUser`, `json`/`error`, `preflight`, CORS for listed origins only)
and live under `/api/*`, because pages still share the namespace;
`proxy.ts`'s matcher stops refreshing cookie sessions on `/api/*`, which
bearer routes never read.

## Decisions

### 1. Test runner: keep Vitest; Jest only where Expo needs it

**Recommendation:** `packages/core` and `apps/api` stay on Vitest (unit and
db projects, configs moved unchanged). `apps/client` uses Jest with
`jest-expo`. Every workspace has a `test` script, so the root `npm test`
runs all of them and nobody needs to remember which runner is where.

Why:
- 121 unit tests (run today: all pass) and 58 database tests are on Vitest. The db project's
  settings carry the house rules (one fork, no file parallelism, `retry: 0`
  because "a retried RLS test is a lie", global setup); porting them to Jest
  is risk with no payoff.
- Core exports TypeScript source and depends on ESM-only `date-fns` v4.
  Vitest runs both natively; Jest needs `ts-jest` plus ESM transform rules.
- `jest-expo` is the one supported way to test React Native components (its
  preset mocks the native modules), so the client cannot use Vitest.

Cost: two runners in one repo. The root `AGENTS.md` says which is where, and
the template's Jest rule is rewritten to match. Rejected: all-Jest (churn in
the suites that guard production) and Vitest in the client (no native module
mocks).

### 2. Sign-in: native Google, Sign in with Apple on iOS, all through Supabase Auth

**Recommendation:**

| Platform | Buttons | How |
| --- | --- | --- |
| iOS | Sign in with Apple, then Google | `expo-apple-authentication` (native sheet; raw nonce to Supabase, SHA-256 of it to Apple via `expo-crypto`) and `@react-native-google-signin/google-signin`; both end in `supabase.auth.signInWithIdToken` |
| Android | Google | `@react-native-google-signin/google-signin` → `signInWithIdToken` |
| Web (Expo) | Google | `signInWithOAuth` with a redirect, as the web does now (no `/auth/callback` needed: supabase-js finishes PKCE in the page) |

All of it sits in `apps/client/src/api/auth.ts`, as the template requires.
Guideline 4.8 only binds the iOS app, so Apple is offered only there.

What it needs:
- **Google Cloud (manual, no API):** an iOS client and an Android client
  (the debug keystore's SHA-1 for development builds; EAS's or Play's
  signing key later) beside the existing web client. `npm run provision`
  prints what to paste, as it does for the web client today.
- **Supabase Auth (production, ask-first, via provision):** the Google
  provider's Client IDs become web, iOS and Android, comma-separated; "Skip
  nonce check" on, which Supabase's guide requires for native Google on iOS;
  `johns://**` added to the redirect URLs. Apple provider on with the bundle
  identifier as its client ID once the Apple account exists (native-only
  Apple needs no secret key).
- A development build. Both libraries are native code, so Expo Go cannot run
  them: `npx expo run:android` / `run:ios` locally.

Two edge cases worth designing for now:
- **Hide My Email splits people.** A housemate who joined on the web with
  Google and later picks Apple with a relay address becomes a second user
  with no house. The iOS sign-in screen says "Already in a house? Use the
  account you joined with", and linking a second identity
  (`linkIdentity`) is a later feature.
- **Apple sends the name once,** in the credential and not the token, so
  `handle_new_user` would fall back to the relay address's local part. On
  the first Apple sign-in the client writes `fullName` into
  `profiles.display_name`, which the existing column grant already allows.

Sign in with Apple cannot be tried on a device until there is an Apple
Developer account. It is built and unit-tested in Phase 4 and must be proven
on a device before `ios` is ever switched on.

### 3. Push: Expo push for iOS and Android, web push stays

**Recommendation:** `expo-notifications` gets an Expo push token on iOS and
Android. The token goes into a new table, `push_tokens` (additive migration:
`user_id`, `token` unique, `platform`, `created_at`; RLS identical to
`push_subscriptions`; grants stated for every role including
`service_role`). `lib/push.ts`'s `Notify` fans out to both: web push with
VAPID exactly as now, and Expo's push API (batches of 100, an optional
`EXPO_ACCESS_TOKEN`). `DeviceNotRegistered` deletes the token, as 404/410 does
for web. The message keeps its `url` (`/week`), which Expo Router opens.
Signing out deletes the device's token.

Why Expo's service rather than talking to FCM and APNs directly: one sender
and one token format for both platforms, with no FCM service-account JSON or
APNs key in Vercel. The price is a dependency on Expo's service and an EAS
project ID in `app.json`.

What it needs, all ask-first in Phase 12:
- An Expo account and EAS project (`eas init`). This is not a store account.
- **Android:** a Firebase project, `google-services.json`, and the FCM v1 key
  uploaded to EAS credentials.
- **iOS:** an APNs key, which needs the Apple Developer account. Until then
  iOS push is built but unproven, and the iOS app simply has no reminders.

The sender treats a missing `push_tokens` table as "no tokens", because
Vercel can deploy before Supabase does.

### 4. Photo receipts: camera or library, same bucket, same rules

**Recommendation:** `expo-image-picker` offers "Take photo" and "Choose
photo" (on web it falls back to a file input). `expo-image-manipulator`
shrinks to 1600px on the long side as JPEG, matching the web, so uploads
stay under the bucket's 5 MB limit and its jpeg/png/webp types. The client
uploads to `proofs` at `<house>/<assignment>/<file>.jpg` with supabase-js,
then calls `mark_done(p_assignment, p_photo_path)`. The storage policies
(`can_upload_proof`) and `mark_done`'s `photo_path` check decide, as now.
The path builder and the resize sum move to core, so both apps use one copy.
Camera and library permission strings go in `app.json` through the plugin's
config, so a refusal is a sentence on screen, never a crash.

### 5. Bin Night in React Native

**Recommendation:**
- **Tokens:** the palette is already hex in `app/globals.css` (no oklch to
  convert). The values move into `packages/core/src/bin-night.ts` as plain
  data: light, dark, the six bin lids, hi-vis, hazard, radius. The client
  has **one theme file**, `apps/client/src/theme.ts`, that turns them into
  React Native styles (colours, Overpass weights, the heading style, spacing,
  48px controls). An `apps/api` unit test reads its own `globals.css` and
  fails if any `--token` differs from core, so the two can't drift while
  both ship. (The test sits in `apps/api` because apps may import packages,
  never the reverse.)
- **Type:** `@expo-google-fonts/overpass`, embedded with the `expo-font`
  config plugin so nothing flashes, in the weights the web uses (400–900).
  A `Heading` component does the uppercase and the tracking, so screens
  never repeat it.
- **Signage:** the `road-sign` wordmark, `HazardTape` (diagonal stripes
  drawn with `react-native-svg`) on late and missed, `Lid` per kind of John,
  `StatusChip`. These are domain components, as they are on the web.
- **Icons:** `lucide-react-native`, reactions included.
- **No emoji:** a client test scans `src/` for `\p{Extended_Pictographic}`,
  so a stray emoji fails CI rather than code review.
- **Light and dark:** `userInterfaceStyle: "automatic"`; the theme follows
  `useColorScheme()`, as next-themes follows the system on the web.
- **Responsive:** tabs along the bottom on phones. On web from 1024px
  (Tailwind's `lg`) a sidebar, with the week board as a table; compact
  controls only there.

**This overrides two lines in the template's `apps/client/AGENTS.md`**
("native tabs, SF Symbols on iOS, Material on Android"). Johns uses
`expo-router`'s JS `Tabs` with lucide icons on every platform: a native tab
bar on iOS needs SF Symbols or bitmaps, which breaks "lucide icons only" and
the Bin Night look. What it gives up is the system tab bar's Liquid Glass on
iOS 26. The rewritten `apps/client/AGENTS.md` says this, so no later agent
"fixes" it. (Open question 3 if you'd rather have native tabs.)

### 6. Agent rules: AGENTS.md only

**Recommendation:** in Phase 2, when the paths change anyway, `CLAUDE.md` is
split up by where each rule applies, and then deleted:

| Goes to | What |
| --- | --- |
| root `AGENTS.md` | the template's root file with "About this app" filled in; the words (John, Johns, the Stake, the Table, the Wall, the deal; never "rota", never "chore app"); the game; the data model; "rules live in the lowest layer"; the clock; the test tiers and their rules; ports; deploys (never `supabase config push`, provision); monorepo rules; the ask-first list |
| `apps/api/AGENTS.md` | Next's agent-rules block (Next 16.2 doesn't regenerate it; 16.4's `next dev` would); Next 16 specifics (`proxy.ts`, Promise `params`, `refresh()`); shadcn and the house customisations; Bin Night on the web; the app shell; the engine; thin server actions; e2e rules (`gotoSettled`, counting what reads the same in every layout); the template's route rules for `/api/*`; and a dated exception: **this app keeps its pages until Expo web parity (Phase 13)** |
| `apps/client/AGENTS.md` (Phase 3) | Expo's block and the template's client rules, plus Bin Night in RN, the lucide/JS-tabs override, and "write through rpc; call apps/api only for the four routes above" |

`.claude/skills/verify/SKILL.md` gets the new paths and commands, and
`.claude/settings.json` keeps its permissions and gains the template's
`expo@claude-plugins-official` plugin in Phase 3. After the merge I open a
fresh session to check the root `AGENTS.md` is actually loaded. If it isn't,
I stop and tell you rather than bring `CLAUDE.md` back.

### 7. Screen order

**Recommendation:** your order, with one addition: **sign-in, join (with
create house), today, week, wall, table, stake, house.** Someone who signs
in with no house and no join link needs "create house" to go anywhere, so it
ships with join.

Admin-only moves (dealing, editing the John list) arrive with House, last.
Until then a house is set up on the web and played on the phone: both
clients hit the same database, so that works from Phase 5. Push comes after
House, because it waits on accounts (decision 3).

### 8. Other choices the plan makes

- **The restructure is two PRs** (Phases 1 and 2), not one. Moving the Next
  app into `apps/api` cannot deploy until Vercel's Root Directory changes,
  and that change should land alone in a PR that is nothing but moves.
  Phase 1 (workspaces and core) builds on Vercel exactly as today. This is
  open question 1.
- **Next.js stays on 16.2.10.** Nothing here needs 16.4, and a framework bump
  isn't a zero-change restructure. It can be its own PR later.
- **One React version** from Phase 3: the root `overrides` pin `react` and
  `react-dom` to what Expo SDK 58 expects (`npx expo install --check` gives
  the exact patch). Next 16.2.10 accepts `^19.0.0`, and the App Router
  renders with Next's own bundled React anyway, so the web app barely notices.
  CI checks `npm ls react` resolves to one version.
- **Metro on port 8205** (`expo start --port 8205`), beside 3205, so it never
  collides with another app made from the template on 8081.
  `ALLOWED_ORIGINS=http://localhost:8205` locally.
- **Data fetching:** `@tanstack/react-query` in the client for caching,
  refetching on focus (`AppState`) and invalidating after a move; Realtime
  events invalidate the same queries, the way `live-refresh.tsx` calls
  `router.refresh()` now. Without it, every screen grows its own loading and
  refetch hooks.
- **Identifiers:** app name `Johns`, slug `johns`, scheme `johns`, bundle ID
  and Android package `dev.glyn.johns`. Bundle IDs are permanent once a store
  has seen them, so this is open question 2.
- **Join links:** `https://johns.glyn.dev/join/CODE` keeps working on the web.
  On a phone it opens in the browser until universal links and app links are
  set up, which need the Apple team ID and the release signing key, so it
  waits for the store accounts. Meanwhile the app takes `johns://join/CODE`,
  and the join screen also takes a typed or pasted code.

## Phases

Each phase is one PR off `main` and leaves lint, typecheck, unit, db, build
and e2e green. Every phase that touches the client ends with an exact list
of what to check on Android, iOS (simulator until the Apple account) and
web. "Production" says what the merge touches beyond an ordinary deploy;
anything listed there waits for your word in that message.

### Phase 1: workspaces and `@app/core` (zero behaviour change)

- Root `package.json` gains `"workspaces": ["packages/*"]` and depends on
  `"@app/core": "*"`. The Next app stays at the root for this phase.
- `packages/core`: the 13 pure modules, `db-types.ts`, an `index.ts` barrel
  (no export-name collisions, checked), `package.json` (private, TS source,
  deps `date-fns`, `@date-fns/tz`, `zod`), `tsconfig.json`, its Vitest config
  and ESLint config, with `lint`, `typecheck` and `test` scripts.
- The unit tests move beside their modules unchanged. The provision test
  moves beside `scripts/provision/lib.mjs`.
- 32 files in the app and `tests/db` switch from `@/lib/<rule>` to
  `@app/core`, and 6 from `@/types/database`; imports inside core become
  relative.
- `next.config.ts`: `transpilePackages: ["@app/core"]`, plus whatever
  Turbopack's monorepo root needs according to `node_modules/next/dist/docs`.
- `npm run types` writes `packages/core/src/db-types.ts`; `npm run db:types`
  becomes the template's alias for it.
- `CLAUDE.md` and README path updates only; `docs/specs/_template.md` added.

Proof: the test files' diff is renames plus import lines (`git diff -M`
shows renames at ≥95% similarity), the same test counts pass, and `next
build` prints the same route table as `main`. The PR's Vercel preview
proves the workspace install on Vercel itself.
Production: an ordinary deploy.

### Phase 2: the Next app becomes `apps/api`; AGENTS.md only (zero behaviour change)

- `git mv` everything in the table above into `apps/api`. Its
  `package.json` takes the Next app's dependencies and scripts, with
  `--port 3205` kept. The root becomes a pure workspace root
  (`"workspaces": ["apps/*", "packages/*"]`) whose scripts delegate: `dev`,
  `build`, `start`, `lint`, `typecheck`, `test`, `test:db`, `test:e2e`,
  `types`, `tick`, `provision`, `vapid`, `db:start|stop|reset`.
- `.env.local` moves to `apps/api/.env.local`. The pinned Supabase CLI
  (2.114.0) turned out to read `env(AUTH_GOOGLE_*)` from the root's
  `.env.local` or `supabase/.env.local`, so the Google values move to
  `supabase/.env.local` (with a `supabase/.env.example`), and provision writes
  them there. CI sets them in the environment, so CI isn't affected.
- CI writes `apps/api/.env.local` and uploads `apps/api/playwright-report`.
- Provision writes the local Google client to `apps/api/.env.local` and gains
  a **read-only** check that the Vercel project's Root Directory is
  `apps/api` (decision unit-tested in `lib.mjs`). It never sets it.
- The `AGENTS.md` merge (decision 6); `CLAUDE.md` deleted; the verify skill,
  README and DEPLOYMENT.md updated.

**Cutover (ask-first; the only production setting the restructure
touches):**
1. PR green in CI. Its Vercel preview will fail while Root Directory is
   still the repo root. That's expected: there is no root app to build.
2. On your word: set Root Directory to `apps/api` (Vercel → johns →
   Settings → Build and Deployment). This doesn't redeploy anything;
   production keeps serving the current deployment.
3. Build the PR's **preview** again (Redeploy in the dashboard, or the next
   real push). It now builds from `apps/api`, which proves Vercel's monorepo
   install and build before production sees them.
4. Merge. Production builds from `apps/api`. Then check: `/signin` answers,
   the cron tick returns 200 (`npm run provision -- --check` does both and
   changes nothing, but it's on your list, so I'll ask), and a page load
   catches a house up.

If any push reaches `main` between steps 2 and 4, its build fails and the
live deployment keeps serving; a failed Vercel build never replaces
production. **Rollback:** Instant Rollback to the previous production
deployment (seconds), Root Directory back to empty, revert the merge.

### Phase 3: `apps/client` scaffold, one React version, the release gate

- `apps/client` from the template: Expo SDK 58, Expo Router in `src/app`,
  `src/api/supabase.ts` with the template's per-platform session storage,
  identifiers from decision 8, Johns' icons and a Bin Night splash.
- The theme (decision 5): tokens in core, `apps/client/src/theme.ts`, fonts,
  `Heading`, `Button` (48px), `Card`, `Wordmark`, `HazardTape`, `Lid`,
  `StatusChip`, and the shell (tabs or sidebar). The only screen is the
  signed-out landing page.
- Root: React `overrides`, `release-targets.json` with both `false`,
  `scripts/release.mjs` (verbatim) and `release:ios` / `release:android`,
  and `dev:client` on 8205. No `eas.json`, no store config.
- `apps/client/AGENTS.md`; the Expo plugin in `.claude/settings.json`.
- CI: a parallel `client` job (lint, typecheck, jest-expo, the emoji scan,
  `expo export -p web`, `expo-doctor`) and a one-React-version check. The
  `globals.css` drift test goes into `apps/api`.

Proof: the web's e2e passes on React 19.3; `npm run release:ios` refuses.
Production: none (`apps/client` isn't deployed anywhere yet).

### Phase 4: sign-in

Decision 2, on all three platforms; the session survives a restart; sign
out. Local `supabase/config.toml` gets the Apple provider (off, `env(...)`
secret) and the `johns://**` redirect; `config.toml` stays local-only, as
ever. The Expo web e2e starts here: Playwright serves the static `expo export`
on 8205 beside the API on 3205, on the same four-row matrix. `e2e/auth.ts`
gains a variant that mints the session into localStorage instead of
cookies. Jest covers `auth.ts` with Supabase mocked, and the nonce helper.
Production (ask-first): Supabase's Google Client IDs, skip-nonce and redirect
URL, through provision. Google Cloud's iOS and Android clients are yours to
create (no API).

### Phase 5: join and create a house, and the API foundation

- `apps/api`: the template's `requireUser` / `respond` / `cors` helpers,
  `POST /api/fresh`, and `proxy.ts` no longer matching `/api/*`. A db-tier
  test calls the route handlers directly: no token is 401, someone else's
  house is refused, and a second call within a minute doesn't tick.
- `apps/client`: no-house screen, `join/[code]` (the same path as the web's
  link), `johns://join/CODE`, create house with locale defaults.
- Core: `CreateHouse` and the join-code shape move into `schemas.ts`; the
  web's actions import them from there.

### Phase 6: Today

Mark done and undo, photo receipts (decision 4), spending immunity, Realtime
invalidation, pull to refresh, catching up on focus. The Today/Week shaping
in `lib/data/week.ts` becomes a pure builder in core that the web loader also
uses, so the web's e2e also proves that refactor. e2e on Expo web: tick a
John with a photo (file chooser) and see its chip change.

### Phase 7: Week

The board (cards on a phone, a table from `lg` on the web), raising a dispute
and voting via the two routes (`apps/api/lib/moves/` shared with the server
actions), swaps. db tests: in a house of two, a dispute decides at once
through the route; a vote can't be cast on your own John.

### Phase 8: the Wall

Events, reactions (lucide), photos through signed URLs, live updates.

### Phase 9: the Table

Standings for the week and the month, from core's `points.ts`.

### Phase 10: the Stake

The ledger, settle-up from core's `stake.ts`, "confirm received" through
`confirm_payment`.

### Phase 11: House

Settings and the John list (admins, via the column grants), groups, time away
(the calendar), members and roles, the invite (the system share sheet with
the link and the code), renaming yourself, signing out, and "Hand out this
week's Johns" through `POST /api/deal`. After this the phone can run a house
from nothing.

### Phase 12: native push

Decision 3. The migration revokes and grants as the house rules say. db
tests: you see and remove only your own tokens; a housemate can't insert a
token for you; the service role reads them. Unit tests for batching and
`DeviceNotRegistered` pruning.
Production (ask-first): the migration reaches the database through Supabase's
GitHub integration if it's on by then, otherwise through provision (`db
push`), which waits for your word; the Expo account, EAS project and Firebase
project; an optional `EXPO_ACCESS_TOKEN` in Vercel.

### Phase 13: web parity and the hosting cutover

Parity means every Playwright spec has a twin that passes against Expo web
on all four rows, plus a manual pass on phone and laptop, light and dark. Then
Expo web takes over johns.glyn.dev. My recommendation for that, to settle at
the time:

- A second Vercel project, `johns-web` (Root Directory `apps/client`, the
  template's `vercel.json`), takes `johns.glyn.dev`.
- Its `vercel.json` rewrites `/api/:path*` to the `johns` project, which gets
  its own hostname. The tick URL in Vault doesn't change, the web needs no
  CORS, and no secret is touched. The alternative is `api.johns.glyn.dev`
  plus a Vault update to `johns_tick_url`, which is cleaner but touches the
  clock.
- `apps/client/public/sw.js` stays at the same path and scope with the same
  VAPID public key, so existing web push subscriptions keep working.
- Everyone signs in once more on the web, because the session moves from
  cookies to localStorage.

Production (ask-first, all of it): the new project and its `EXPO_PUBLIC_*`
env, the domain move, Supabase's site URL and redirect URLs.

### Phase 14: `apps/api` goes headless

Once the domain has served Expo web for a while without a rollback: remove
the pages, components, shadcn, Tailwind and the server actions, and
`apps/api` becomes route handlers only, as the template intends. The cookie
e2e suite retires; the Expo web suite carries on.

## Ask-first, in one list

| Phase | What | Who |
| --- | --- | --- |
| 2 | Vercel Root Directory → `apps/api`; preview redeploy; merge; read-only provision check | you, or me through the Vercel connector on your word |
| 4 | Supabase Auth: Google client IDs, skip nonce, `johns://**` (via provision) | me on your word; Google Cloud clients are yours |
| 12 | migration to production; Expo/EAS and Firebase projects; `EXPO_ACCESS_TOKEN` | you, or me on your word |
| 13 | new Vercel project, domain, Supabase site and redirect URLs; Vault only if you choose the subdomain | you, or me on your word |
| any | `npm run provision`, `supabase db push`, a production deploy, Vault, VAPID, `release:*`, `eas build --profile production`, `eas submit`, `eas update` | never without your say-so in that message |

## Risks

- **Vercel builds the whole workspace:** installing Expo and React Native for
  the API's build costs time. Measure it in Phase 3's preview; scope the
  install from `apps/api/vercel.json` if it hurts.
- **Two React toolchains in one `node_modules`** (Next and Metro), with
  `legacy-peer-deps=true` hiding peer conflicts. `expo-doctor` and the
  one-React check in CI catch most of it.
- **Apple accounts split from Google ones** (decision 2). The sign-in copy
  covers it for now; identity linking is a later feature.
- **iOS can only be checked on a simulator** until the Apple account exists,
  which means a Mac. Sign in with Apple and iOS push can't be proven before
  then.
- **CI time roughly doubles** once the Expo web e2e runs on the full matrix.
  The client job runs in parallel; the two e2e suites share one Supabase
  start.
- **AGENTS.md loading:** the template's premise is that Claude Code reads
  AGENTS.md when there's no CLAUDE.md. Checked in a fresh session in
  Phase 2.

## Questions, answered

1. **The restructure as two PRs** (Phases 1 and 2), so the Root Directory
   change lands alone? **Yes.**
2. **Identifiers:** `dev.glyn.johns` for the iOS bundle ID and Android
   package, `johns` as the URL scheme? **Yes.**
3. **Tabs:** JS tabs with lucide everywhere, or native tabs with SF Symbols
   and Material icons? **JS tabs with lucide.**
4. **Phase 2's switch:** will you flip Root Directory in the dashboard, or
   should I do it through the Vercel connector when you say so? **Asked
   again when Phase 2's PR is green.**
5. **A Mac for the iOS simulator?** **Yes**, so iOS is checked on the
   simulator until the Apple account exists.
6. **Accounts in Phase 12:** OK to plan on an Expo account and a Firebase
   project then (neither is a store account)? **Yes.**

## Done when

- [ ] iOS, Android and web each sign in, join or create a house, and play
      every screen.
- [ ] johns.glyn.dev has served throughout, with the clock ticking and web
      push arriving.
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db` and
      both e2e suites pass from the root.
- [ ] `release-targets.json` is still `{ "ios": false, "android": false }`.
