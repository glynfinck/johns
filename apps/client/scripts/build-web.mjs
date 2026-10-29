// Vercel builds the web app with this (vercel.json's buildCommand); locally
// `npm run export:web` is the same build.
//
// Production calls /api/* on its own origin, which vercel.json passes on to
// api.jonz.app. A preview must not: it runs on staging's database, so it
// calls staging's API instead, cross-origin (apps/api lets staging's origins
// in through ALLOWED_ORIGINS). Which one: the same branch's preview of
// apps/api, so a PR that changes both is tried together, found through
// Vercel's related projects (vercel.json); otherwise EXPO_PUBLIC_API_URL from
// the Preview environment, https://api.staging.jonz.app. The staging branch
// itself always uses that name.
import { spawnSync } from "node:child_process";

const API_PROJECT = "prj_7iAOREFWVIdf2Xi5TAoyO9a9ma7R"; // jonz-api

/** The host of jonz-api's preview for this branch, from VERCEL_RELATED_PROJECTS, or null. */
export function relatedApiHost(raw, projectId = API_PROJECT) {
  try {
    const related = JSON.parse(raw ?? "[]");
    const api = related.find((p) => p?.project?.id === projectId);
    return typeof api?.preview?.branch === "string" && api.preview.branch ? api.preview.branch : null;
  } catch {
    return null;
  }
}

/** The environment the export runs with. */
export function buildEnv(source) {
  const env = { ...source };
  if (source.VERCEL_ENV !== "preview") return env;
  const host = source.VERCEL_GIT_COMMIT_REF === "staging" ? null : relatedApiHost(source.VERCEL_RELATED_PROJECTS);
  if (host) env.EXPO_PUBLIC_API_URL = `https://${host}`;
  return env;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = buildEnv(process.env);
  if (env.VERCEL_ENV === "preview") {
    if (env.EXPO_PUBLIC_API_URL) console.log(`Preview: the app calls ${env.EXPO_PUBLIC_API_URL}`);
    else console.warn("Preview with no EXPO_PUBLIC_API_URL: staging isn't set up in Vercel's Preview environment yet (DEPLOYMENT.md).");
  }
  const run = spawnSync("npm", ["run", "export:web"], { stdio: "inherit", env });
  process.exit(run.status ?? 1);
}
