---
name: verify
description: Build, run and drive the Johns apps (Next.js, the Expo app, local Supabase) to verify a change end-to-end.
---

# Verifying Johns changes

## Run

- Local Supabase: `supabase start` (API 127.0.0.1:54341, DB 54342), with its
  Google values in `supabase/.env.local` (see `supabase/.env.example`).
  `apps/api/.env.local` points the app at it (see `apps/api/.env.example`).
  New migration: `supabase db reset` (or `supabase migration up`), then
  `npm run types`.
- App: `npm run dev` serves http://localhost:3205. Playwright's webServer
  reuses a running one.
- Expo app: `npm run dev:client` runs Metro on 8205 (press `w` for web). To
  look at the web build without Metro, `npm run export:web -w apps/client`
  writes `apps/client/dist`; serve it on 8205 (it's a single-page app).
- psql: `psql postgresql://postgres:postgres@127.0.0.1:54342/postgres`.

## Drive

- Signed-in flows without Google: `apps/api/e2e/auth.ts` `signInAs(context, name)`
  mints a real session with the admin API and hands the cookies to a browser
  context. `cleanUp(userIds)` removes what it made.
- The clock: open any house page (it catches the house up), or
  `npm run tick` to run the cron tick for every house (needs `CRON_SECRET`).
  To see a week end, drive `tickHouse(adminClient, houseId, futureDate)` from
  a db test rather than waiting.
- Look at both layouts: phone (412px) and laptop (1440px), light and dark.

## Gates

`npm run lint`, `npm run typecheck`, `npm test` (every workspace, the Expo
app's Jest included), `npm run test:db`, `npm run build`, `npm run test:e2e`.
For a change to `apps/client`, also `npm run export:web -w apps/client` and,
with network, `npx expo-doctor` in `apps/client`.
