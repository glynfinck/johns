import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

// The db project talks to the local stack with the service-role key, which
// lives in .env.local beside the URL and anon key. Workers are forked from
// this process, so they inherit whatever is loaded here.
dotenv.config({ path: ".env.local", quiet: true });

// `@/x` → apps/api/x, matching tsconfig's paths. Match the slash: a bare "@"
// alias is a prefix match and would also swallow "@supabase/ssr".
const alias = [
  { find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) },
];

export default defineConfig({
  test: {
    projects: [
      // The pure rules are tested in packages/core. This app's own pure
      // helpers, when it has any, go here.
      {
        resolve: {
          alias: [
            ...alias,
            { find: /^server-only$/, replacement: fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)) },
          ],
        },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          // Pure functions only: no stack, no network, no clock.
          testTimeout: 5_000,
        },
      },
      {
        resolve: {
          alias: [
            ...alias,
            // Route handlers reach `server-only` modules (the engine's
            // service-role client); see tests/support/server-only.ts.
            { find: /^server-only$/, replacement: fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)) },
          ],
        },
        test: {
          name: "db",
          environment: "node",
          include: ["tests/db/**/*.test.ts"],
          globalSetup: ["tests/db/global-setup.ts"],
          setupFiles: ["tests/db/setup.ts"],
          // One conversation with the database at a time: every file seeds
          // real rows into the single local stack.
          pool: "forks",
          maxWorkers: 1,
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
          // A retried RLS test is a lie: either the policy allows it or not.
          retry: 0,
        },
      },
    ],
  },
});
