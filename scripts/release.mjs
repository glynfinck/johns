// Build the native app with EAS and send it to a store, but only if that
// store is switched on in release-targets.json. It publishes: ask first.
//
//   npm run release:ios
//   npm run release:android
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { releaseRefusal } from "./release/lib.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "apps", "client");
const platform = process.argv[2];
const targets = JSON.parse(readFileSync(path.join(root, "release-targets.json"), "utf8"));

const refusal = releaseRefusal(platform, targets, existsSync(path.join(clientDir, "eas.json")));
if (refusal) {
  console.error(refusal.message);
  process.exit(refusal.code);
}

const result = spawnSync(
  "npx",
  ["eas-cli@latest", "build", "--platform", platform, "--profile", "production", "--auto-submit"],
  { cwd: clientDir, stdio: "inherit", shell: process.platform === "win32" },
);
process.exit(result.status ?? 1);
