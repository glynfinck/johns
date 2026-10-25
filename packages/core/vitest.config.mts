import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "core",
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Pure functions only: no stack, no network, no clock.
    testTimeout: 5_000,
  },
});
