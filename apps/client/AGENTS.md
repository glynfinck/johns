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
  network calls inline.
- `src/api/`: every network call.
  - `supabase.ts`: the Supabase client, typed with `Database` from
    `@app/core`, publishable key only; `storage.ts` / `storage.web.ts` keep
    the session on each platform.
  - `auth.ts`: all sign-in and sign-out. Native Google and Sign in with Apple
    (iOS) arrive in Phase 4.
  - `http.ts` (Phase 5): `apiFetch` for calls to `apps/api`, sending the
    user's token and validating the response with a schema from `@app/core`.
- **Writes go through the database, as the web's do.** A move is one named
  SQL function (`supabase.rpc('mark_done', …)`) or one column-granted write;
  the database decides, and the client only translates a refusal with
  `humanError` from `@app/core` and refreshes. `apps/api` is called only for
  the four moves that need a server: `POST /api/deal`, `POST /api/disputes`,
  `POST /api/disputes/:id/votes` and `POST /api/fresh`.
- `src/hooks/`: connect `@app/core` and `src/api/` to screens (e.g.
  `use-session.ts`). `src/components/`: reusable UI pieces.
- Shared code by default. Use platform files (`.ios.tsx`, `.android.tsx`,
  `.web.tsx`) or `Platform.OS` only where behaviour truly differs.
- Web is a single-page build: keep `"web": { "output": "single" }` in
  app.json. It isn't deployed yet: johns.glyn.dev stays `apps/api`'s pages
  until the Expo web build reaches parity (Phase 13).
- When a change adds a native module or config plugin, say clearly that a
  new development build is needed.
- Environment: copy `.env.example` to `.env.local`. Only `EXPO_PUBLIC_`
  values go here.
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
- **Controls** are at least `TAP` (48) tall; links get the same target.
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
what they test (`<name>.test.ts(x)`). Pure logic belongs in `@app/core`
with Vitest; tests here cover screens, components and the theme.

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
