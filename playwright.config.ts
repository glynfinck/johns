import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// e2e/auth.ts mints sessions with the service role key, which lives in
// .env.local alongside the stack's URL and anon key.
dotenv.config({ path: ".env.local", quiet: true });

const PORT = 3205;

// A sandbox whose preinstalled Chromium does not match this Playwright can
// point at it instead of downloading (PW_CHROMIUM=/opt/pw-browsers/chromium).
const chromium = process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {};

/**
 * E2E against the local Supabase stack (ports 54341-54344), once per row of
 * the platform matrix: the phones a house actually has, and the laptop the
 * week board is designed for.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: process.env.CI ? 180_000 : 90_000,
  expect: { timeout: process.env.CI ? 30_000 : 15_000 },
  // Retries record a trace; failOnFlakyTests still fails the run. Green has
  // to mean green.
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "android-chrome", use: { ...devices["Pixel 7"], ...chromium } },
    { name: "iphone-safari", use: { ...devices["iPhone 15"] } },
    { name: "desktop-firefox", use: { ...devices["Desktop Firefox"] } },
    // The laptop board's three-column layout starts at `lg`; this row holds it.
    {
      name: "laptop-chrome",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, ...chromium },
    },
  ],
  webServer: {
    command: process.env.CI ? `npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/signin`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
