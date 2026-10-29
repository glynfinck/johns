import { describe, expect, it } from "vitest";

import { buildEnv, relatedApiHost } from "../apps/client/scripts/build-web.mjs";

// Which API a build of the web app calls (apps/client/scripts/build-web.mjs).

const API = "prj_7iAOREFWVIdf2Xi5TAoyO9a9ma7R";
const related = (branch: string | undefined) =>
  JSON.stringify([
    { project: { id: API, name: "jonz-api" }, production: { url: "jonz-api.vercel.app" }, preview: { branch } },
  ]);
const STAGING_API = "https://api.staging.jonz.app";

describe("the web build's API", () => {
  it("leaves production on its own origin", () => {
    const env = buildEnv({ VERCEL_ENV: "production", VERCEL_RELATED_PROJECTS: related("x.vercel.app") });
    expect(env.EXPO_PUBLIC_API_URL).toBeUndefined();
  });

  it("sends a preview to the same branch's API preview", () => {
    const env = buildEnv({
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "fix-thing",
      VERCEL_RELATED_PROJECTS: related("jonz-api-git-fix-thing-glynfincks-projects.vercel.app"),
      EXPO_PUBLIC_API_URL: STAGING_API,
    });
    expect(env.EXPO_PUBLIC_API_URL).toBe("https://jonz-api-git-fix-thing-glynfincks-projects.vercel.app");
  });

  it("falls back to staging's API when there's no related preview, and always uses it on the staging branch", () => {
    expect(buildEnv({ VERCEL_ENV: "preview", EXPO_PUBLIC_API_URL: STAGING_API }).EXPO_PUBLIC_API_URL).toBe(STAGING_API);
    expect(
      buildEnv({
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "staging",
        VERCEL_RELATED_PROJECTS: related("jonz-api-git-staging-glynfincks-projects.vercel.app"),
        EXPO_PUBLIC_API_URL: STAGING_API,
      }).EXPO_PUBLIC_API_URL,
    ).toBe(STAGING_API);
  });

  it("reads nothing from a missing, broken or unrelated list", () => {
    expect(relatedApiHost(undefined)).toBeNull();
    expect(relatedApiHost("not json")).toBeNull();
    expect(relatedApiHost(JSON.stringify([{ project: { id: "prj_other" }, preview: { branch: "x" } }]))).toBeNull();
    expect(relatedApiHost(related(undefined))).toBeNull();
  });
});
