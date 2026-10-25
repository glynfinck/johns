// Run the clock by hand: POST the cron tick to a running app.
//
//   npm run tick                      → http://localhost:3205
//   TICK_URL=https://… npm run tick   → anywhere, with that deployment's secret
//
// Reads CRON_SECRET from the environment or apps/api/.env.local.
import { readFileSync } from "node:fs";

let secret = process.env.CRON_SECRET;
if (!secret) {
  try {
    const env = readFileSync(new URL("../apps/api/.env.local", import.meta.url), "utf8");
    secret = env.match(/^CRON_SECRET=(.*)$/m)?.[1]?.trim();
  } catch {
    // No .env.local: fall through to the error below.
  }
}
if (!secret) {
  console.error("CRON_SECRET is not set (environment or apps/api/.env.local).");
  process.exit(1);
}

const url = process.env.TICK_URL ?? "http://localhost:3205/api/cron/tick";
const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
console.log(res.status, await res.text());
process.exit(res.ok ? 0 : 1);
