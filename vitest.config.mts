import { defineConfig } from "vitest/config";

// The root holds only the repo's own scripts: the decisions `npm run
// provision` and `npm run release:*` make. Every workspace tests itself
// (`npm test` runs them all).
export default defineConfig({
  test: {
    name: "scripts",
    environment: "node",
    include: ["scripts/**/*.test.ts"],
    // Pure functions only: no stack, no network, no clock.
    testTimeout: 5_000,
  },
});
