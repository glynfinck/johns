# Johns

Fair shares of the housework, and a house that keeps score. In our house the week's assigned
chores were always "Johns", so that is what the app calls them: one chore is
a **John**.

- **Fair shares, dealt for you.** Every John has an effort score (1–10), a
  kind, a due day and a cadence. Each week the Johns are shared so effort
  evens out over the month, and the bathroom moves around.
- **Groups.** Three of you share the upstairs bathroom and two the
  downstairs one? Put each bathroom's Johns in a group, and only that group
  is handed them, and only they count toward its share.
- **Time away that stays fair.** Book your dates and you aren't handed
  Johns due while you're gone, but your share keeps counting, so you catch up
  a little each week when you're back (the house can make that half, or
  none). Johns you already have when you book become due before you go.
- **Housemate check.** A tick stands after 24 hours unless someone disputes
  it; disputes go to a quick house vote. Photo receipts are optional, or
  required on the Johns you choose.
- **The Stake.** Everyone stakes the same each month. Late and missed Johns
  forfeit part of it, and at month end the forfeits are shared among everyone
  else. The app keeps the ledger and works out who pays whom; it never moves
  money.
- **The Table, streaks and perks.** Points for every John done (half for
  late). Four clean weeks in a row earn an immunity token; topping the week
  earns a swap.
- **The Wall.** Ticks, photos, misses, disputes and perks as they happen,
  with reactions.
- **Reminders** by push notification, installable to the home screen.

It works on any phone and spreads out on a laptop, in the Bin Night house
style: council signage, hi-vis amber, a bin-lid colour per kind of John.

## Stack

The same shape as Pub Golf, Graph Editor and glyn.dev: Next.js 16 on Vercel,
Supabase (Postgres, RLS, Auth with Google, Storage, Realtime, pg_cron),
shadcn/ui on Tailwind 4, Vitest and Playwright, in an npm workspace shaped
like `glynfinck/app-template`, on its way to iOS and Android with an Expo app
(SDK 58, Expo Router, Jest; `docs/specs/native-migration.md`). See
`AGENTS.md` for how it fits together and why.

## Repo map

```
packages/core/                 @app/core, the pure rules: week, deal, outcome, points, streak, stake, dispute;
                               Bin Night's colours and the shared words
apps/api/                      the Next.js app at johns.glyn.dev
  app/(house)/                 today · week · wall · table · stake · house
  app/join/[code]/             the join link
  app/api/cron/tick/           the clock (called by pg_cron)
  components/                  shell, John cards and actions, house settings, ui (shadcn)
  lib/engine/                  the tick: applies the rules to the database
  lib/actions/ lib/data/       server actions and loaders
  tests/db/                    the database attacked (the rules' tests sit beside them in core)
  e2e/                         phones and a laptop, end to end
apps/client/                   the Expo app for iOS, Android and web (so far: the front door)
  src/app/                     screens (Expo Router)
  src/components/ src/theme.ts Bin Night in React Native
supabase/migrations/           schema, RLS, the housemate functions, the cron job
scripts/                       provision, the clock by hand, VAPID keys, the store release gate
```

## Develop

Node 22, Docker, the Supabase CLI.

```sh
npm ci
cp supabase/.env.example supabase/.env.local
supabase start                         # ports 54340–54344
cp apps/api/.env.example apps/api/.env.local   # then fill in from `supabase status -o env`
npm run dev                            # http://localhost:3205
npm run dev:client                     # the Expo app: Metro on 8205 (w for web)
```

The Expo app reads `apps/client/.env.local` (copy `.env.example`). Its web
build signs in as the web app does; on iOS and Android, sign-in needs a
development build (`npx expo run:ios` / `run:android` in `apps/client`;
Expo Go can't) and Google's app clients (DEPLOYMENT.md).

Sign-in is Google, plus Apple in the iOS app. To use the app locally without
a Google client, create a user in Studio (http://127.0.0.1:54343) and sign
in with the `apps/api/e2e/auth.ts` approach, or configure a Google OAuth
client for localhost.

## Test

```sh
npm test            # pure rules (@app/core), the Expo app's Jest, the scripts' decisions; no stack
npm run test:db     # RLS, the housemate functions and the engine, on the local stack
npm run test:e2e    # Playwright, the web app and the Expo web build: Pixel 7, iPhone 15, desktop Firefox, a 1440px laptop
```

## Deploy

See `DEPLOYMENT.md`. The Expo app isn't deployed anywhere yet, and store
releases stay off in `release-targets.json` until the store accounts exist.

## Later

Bounties, swapping Johns by agreement, history and stats per housemate, pay
links or Stripe to settle up, a calendar feed, more than one house per
person, and posts in the house group chat.
