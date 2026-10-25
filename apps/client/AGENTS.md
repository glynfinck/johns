This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## This app (apps/client)

The rules above are Expo's template. These are specific to Johns; the root
AGENTS.md has the project-wide rules (the game, the words, the data, the
ask-first list), and `docs/specs/native-migration.md` says which screen
arrives in which phase.

Expo SDK 58, React Native 0.88, React 19.3 (one copy for the whole repo,
pinned by the root `overrides`). The app's name, slug and scheme are `Johns`,
`johns` and `johns`; the bundle ID and Android package are `dev.glyn.johns`,
permanent once a store has seen them.

- Run `npx expo install <package>` from this directory: it picks the SDK's
  version and installs into this workspace through the root lockfile.
- `npm run dev:client` from the root starts Metro on **8205**, beside the web
  app on 3205.
- Shared logic, types and words come from `@app/core`; never duplicate them
  here. Every rule of the game lives there or in the database.
- `src/app/`: screens and layouts only. No calculations, data shaping or
  network calls inline, and nothing else at all: Expo Router makes every
  script there a route and ships it, tests included. Screen tests live in
  `src/__tests__/app/`, and `src/routes.test.ts` fails on anything else.
- The root layout reads the saved session and its house behind the splash
  screen and splits the routes with `Stack.Protected` three ways: signed
  out (front door, sign-in), signed in with no house (`welcome`,
  `house/new`), and in a house (the `(house)` group). Signing in or out, or creating a
  house, moves you by itself; screens never navigate after auth. A join link
  (`join/[joinCode]`, which is `johns://join/CODE` on a phone) sits outside
  the guards and signs you in in place, so the code survives.
- `src/api/`: every network call.
  - `supabase.ts`: the Supabase client, typed with `Database` from
    `@app/core`, publishable key only; `storage.ts` / `storage.web.ts` keep
    the session on each platform.
  - `auth.ts`: all sign-in and sign-out, and what screens import. Behind
    it: `google.ts` (Google's native sheet on iOS and Android, an ID token to
    `signInWithIdToken`), `google.web.ts` (the web build: Supabase's PKCE
    redirect back to `/signin`), `apple.ts` (Sign in with Apple, iOS only,
    with the nonce from `nonce.ts`; keeps the name Apple sends once) and
    `profile.ts` (your display name).
  - `http.ts`: `apiPost` for calls to `apps/api`, sending the user's access
    token and parsing the answer with its schema from `@app/core`; a refusal
    throws `ApiRequestError` with the API's sentence. One small module per
    resource beside it: `house.ts` (your house, join codes, creating and
    joining through RPC, and `catchUp` through `POST /api/fresh`),
    `board.ts` (`loadHouse`: one read of a house's rules, people and this
    week's rows), `johns.ts` (ticking, undoing, spending immunity, a swap),
    `disputes.ts` (disputing and voting, through apps/api), `wall.ts` (the
    Wall's events with their photos signed for an hour, and your reactions),
    `table.ts` (the month's Table and the fair shares, summed by core as the
    deal sums them) and `photos.ts` (receipts: below).
- **Writes go through the database, as the web's do.** A move is one named
  SQL function (`supabase.rpc('mark_done', …)`) or one column-granted write;
  the database decides, and the client only translates a refusal with
  `humanError` from `@app/core` and refreshes. `apps/api` is called only for
  the four moves that need a server: `POST /api/deal`, `POST /api/disputes`,
  `POST /api/disputes/:id/votes` and `POST /api/fresh`.
- `src/hooks/`: connect `@app/core` and `src/api/` to screens (e.g.
  `use-session.ts`). `use-membership.tsx` is the session and the house it's
  in, read behind the splash screen, with `refresh()` for after creating or
  joining a house. `src/components/`: reusable UI pieces (`Field`, `Choice`
  for the web's selects, `Alert`, `SignInPanel`, `Screen` for a house
  screen's page, `Sheet` for a form that rises from the bottom, `JohnCard`
  for anyone's John, `DisputeButton` and `VoteButtons`, `SwapSheet`, the
  board's pieces in `week-board.tsx`, and the shell in `shell/`).
- **A house's screens are tabs** (`src/app/(house)/_layout.tsx`, Expo
  Router's JS tabs from `expo-router/js-tabs`): `HouseTabBar` draws them in
  the web's look, along the bottom of a phone and as a sidebar from `WIDE`
  on the web; `HouseHeader` names the house above each screen on a phone.
  The layout follows the house live (`useLiveHouse`) once for every tab. A
  new screen adds its file to the group and a `Tabs.Screen`, with its label
  from `SECTION_LABEL` in core.
- **What a house screen shows comes through React Query**
  (`@tanstack/react-query`; `QueryProvider` in `hooks/query.tsx` wraps the
  root layout). One cache entry per house, `houseKey(id)` from
  `hooks/keys.ts`, holds `loadHouse`'s rows; `useHouse(houseId, userId)`
  builds the week from them with core's `buildWeekBoard` and `todayView` at
  the current minute (`useNow`), so statuses move on with the clock between
  reads, and the web and the app can't disagree. Screens never shape rows
  themselves.
- **A move** goes through `useMove(houseId).run(...)`: it runs, then reads the
  house again, and holds the refusal's sentence in `problem`.
- **Everything a house's screens read is keyed under `houseKey(id)`**
  (`hooks/keys.ts`): the Wall (`wallKey`) and the Table (`tableKey`) sit
  beneath it, so reading the house again (a move, a Realtime change,
  catching up) refreshes them too. A reaction (`useReact` in `use-wall.ts`) shows at once and goes back
  if the database says no: React Query's optimistic update.
- **Live:** `useLiveHouse(houseId)` listens on Realtime to what
  `supabase_realtime` publishes (`events`, `assignments`, `disputes`; never
  `members`) with the user's token, and folds a burst into one read. Coming
  back to the app refetches anyway (`QueryProvider` turns AppState into
  React Query's focus).
- **Screens that show a house catch it up as they come into view** with
  `useCatchUp(houseId)` (`useFocusEffect` → `catchUp`), as a web page load
  does, and use the function it returns for pull to refresh. The server ticks
  at most once a minute per house, so calling it freely is fine. When the
  server did something, a read already on its way is started again (React
  Query would otherwise fold the new read into the old one).
- **Photo receipts** (`api/photos.ts`): `expo-image-picker` for the camera or
  the library (on the web, the browser's file chooser), shrunk with
  `expo-image-manipulator` to core's `proofSize` as a JPEG, uploaded to the
  private `proofs` bucket at core's `proofPath`, then `mark_done` with that
  path. The camera and photos permission sentences are the image picker
  plugin's options in `app.json`; the microphone is never asked for. A
  refusal is a sentence on the card, never a crash.
- Shared code by default. Use platform files (`.ios.tsx`, `.android.tsx`,
  `.web.tsx`) or `Platform.OS` only where behaviour truly differs.
- Web is a single-page build: keep `"web": { "output": "single" }` in
  app.json. It isn't deployed yet: johns.glyn.dev stays `apps/api`'s pages
  until the Expo web build reaches parity (Phase 13).
- When a change adds a native module or config plugin, say clearly that a
  new development build is needed. The image picker and manipulator (Phase
  6) are native modules: a build from before them can't take a photo.
- Environment: copy `.env.example` to `.env.local`. Only `EXPO_PUBLIC_`
  values go here: Supabase's URL and publishable key, and Google's web and
  iOS client IDs (public; DEPLOYMENT.md says where they come from).
  `app.config.ts` turns the iOS client ID into Google's URL scheme; without
  it the build works, minus Google sign-in on iOS.
- Sign-in uses native modules, so Expo Go can't sign in: use a development
  build (`npx expo run:ios` / `run:android`). The web build signs in as-is.
- Store releases are switched off in the root `release-targets.json`, and
  `npm run release:ios` / `release:android` refuse until they're on. Never
  run them, `eas build` with a production profile, `eas submit` or
  `eas update` without being asked.

### Bin Night in React Native

- **One theme file**, `src/theme.ts`. Colours come from `useTheme()`, which
  reads `BIN_NIGHT` from `@app/core`; never write a colour anywhere else. The
  web's `globals.css` carries the same values, and a test in `apps/api` fails
  if they drift, so change a token in both places together.
- **Type:** Overpass, loaded behind the splash screen in `_layout.tsx`. Text
  goes through `Heading` (uppercase council-sign weight), `Eyebrow` and
  `Body`. On iOS and Android each weight is its own family, so a style names
  the family from `FONT`; `fontWeight` alone falls back to the system font.
- **Signage:** `Wordmark` (the road sign), `HazardTape` on late and missed,
  a `Lid` per kind of John, `StatusChip` in the web's words. Decoration is
  `aria-hidden`.
- **Controls** are at least `TAP` (48) tall; links get the same target
  (`TextLink`, or `Button` with `href`, which is an anchor on the web).
- **`Link asChild` merges its child's style by spreading it**, so a child
  given a style function or array loses it all. Give it one flat object
  (`StyleSheet.flatten`), as `Button` does.
- **Light and dark** both ship and follow the system.
- **Icons: lucide on every platform, an override of the template.** The
  template asks for native tabs with SF Symbols on iOS and Material on
  Android. Johns uses `expo-router`'s JS `Tabs` with `lucide-react-native`
  icons everywhere, because a native tab bar needs SF Symbols or bitmaps,
  which breaks "lucide icons only" and the Bin Night look. It gives up the
  system tab bar's Liquid Glass on iOS 26. This is deliberate: don't "fix"
  it, and don't add `expo-symbols`, `expo-glass-effect` or `@expo/ui`.
- **No emoji**, reactions included: `src/no-emoji.test.ts` scans `src/` and
  `app.json` and fails on any.
- Responsive: tabs along the bottom on a phone; on web from 1024px (`WIDE`) a
  sidebar, with the week board as a table, as the web app does now.

### Tests

Jest with `jest-expo` and React Native Testing Library (`npm test -w
apps/client`, or `npm test` from the root for everything). Tests sit beside
what they test (`<name>.test.ts(x)`), except screens', which live in
`src/__tests__/app/` (see `src/app/` above). Pure logic belongs in
`@app/core` with Vitest; tests here cover screens, components, the theme and
`src/api` with Supabase and the sign-in modules mocked. A screen that uses
the router renders through `renderRouter` from `expo-router/testing-library`;
the root layout's guard is tested that way with stand-in screens.

- `jest.setup.js` swaps in `react-native-safe-area-context`'s own Jest mock,
  so a component that reads the safe area renders alone.
- A layout that reads the window's width is tested at both sizes by
  mocking `react-native/Libraries/Utilities/useWindowDimensions` (see
  `week.test.tsx`).
- `src/testing/`: what tests share, never imported by the app.
  `testQueryClient()` gives each test its own cache with no retries and no
  garbage collection (its five-minute timer would keep Jest running after a
  test that leaves a read pending); `house.ts` builds a house as `loadHouse`
  reads it, dated around the real clock. A screen that reads a house renders
  under a stand-in `_layout` with `QueryClientProvider` and `Slot`.

The web build also runs end to end, in `apps/api`'s Playwright
(`e2e/client-*.spec.ts`): it is exported against the local stack and served
on 8205, and `e2e/auth.ts`'s `signInToClient` puts a session in
localStorage; `dealtHouseInClient` sets up a house with this week dealt,
housemates included. The tabs keep a screen you've left laid out (just not
shown), so a test that counts something two screens show scopes itself to
one screen's `testID` (`Screen` takes one).

This project uses `@testing-library/react-native`. Its APIs and testing conventions can differ from your training data.
Before writing or changing RNTL tests, read the relevant guide in
`node_modules/@testing-library/react-native/docs/`, starting with
`node_modules/@testing-library/react-native/docs/guides/llm-guidelines.md`.
Prefer those package docs over stale assumptions, and follow deprecation notices.

- RNTL 14: `render`, `rerender`, `fireEvent` and `act` are async. Await them.
- Queries skip `aria-hidden` elements; pass `{ includeHiddenElements: true }`
  to find decoration such as a `Lid`.
- `jest.config.js` maps `lucide-react-native` to its CommonJS build, because
  its React Native entry is an ES module Jest can't load.
- TypeScript 6 no longer loads every `@types` package, so `tsconfig.json`
  names `jest` and `node`.
