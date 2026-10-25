import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CONFIG } from "./config.mjs";
import {
  apexDomain,
  authProblems,
  authSettings,
  authorizeProblems,
  envPlan,
  webEnvPlan,
  googleClientIds,
  googleConsoleValues,
  googleSkipsNonce,
  googleSteps,
  googleVerdict,
  migrationVersion,
  missingMigrations,
  parseEnvFile,
  pickKeys,
  domainPlan,
  rootDirectoryProblem,
  setEnvLine,
  summaryMarkdown,
  todoText,
  tokenHint,
  vaultUpsertSql,
} from "./lib.mjs";

/**
 * The decisions `npm run provision` makes before it calls anything. The
 * failures pub-golf hit all reported success on the way in, so most of these
 * are about reading back and refusing what only looks right.
 */

const GOOGLE = { clientId: "123-abc.apps.googleusercontent.com", secret: "shh" };
const REF = "abcdefghijklmnopqrst";
const ANDROID_ONLY = { ...CONFIG, google: { iosClientId: null, androidClientIds: ["android-dev.apps.googleusercontent.com"] } };
const NATIVE = {
  ...CONFIG,
  google: {
    iosClientId: "ios-1.apps.googleusercontent.com",
    androidClientIds: ["android-dev.apps.googleusercontent.com", "android-store.apps.googleusercontent.com"],
  },
};

describe("auth settings", () => {
  it("sends only production's fields, never the local config", () => {
    expect(authSettings(CONFIG, null)).toEqual({
      site_url: "https://johns.glyn.dev",
      uri_allow_list: "https://johns.glyn.dev/**",
      external_email_enabled: false,
    });
    expect(authSettings(CONFIG, GOOGLE)).toMatchObject({
      external_google_enabled: true,
      external_google_client_id: GOOGLE.clientId,
      external_google_secret: GOOGLE.secret,
    });
  });

  it("accepts the settings it wrote when they read back the same", () => {
    expect(authProblems({ ...authSettings(CONFIG, GOOGLE), external_google_secret: undefined }, CONFIG, GOOGLE)).toEqual([]);
  });

  it("catches a client ID that is still an unresolved env() placeholder", () => {
    const read = { ...authSettings(CONFIG, GOOGLE), external_google_client_id: "env(AUTH_GOOGLE_CLIENT_ID)" };
    expect(authProblems(read, CONFIG, GOOGLE)).toEqual([
      "the Google client ID is the unresolved placeholder env(AUTH_GOOGLE_CLIENT_ID)",
    ]);
  });

  it("catches localhost written over the site URL, and email sign-up left on", () => {
    const read = { ...authSettings(CONFIG, null), site_url: "http://localhost:3205", external_email_enabled: true };
    expect(authProblems(read, CONFIG, null)).toEqual([
      "site URL is http://localhost:3205, not https://johns.glyn.dev",
      "email sign-up is still on",
    ]);
  });

  it("lists the web client first, then the app's iOS and Android clients", () => {
    expect(googleClientIds(CONFIG, GOOGLE)).toBe(GOOGLE.clientId);
    expect(googleClientIds(NATIVE, GOOGLE)).toBe(
      `${GOOGLE.clientId},ios-1.apps.googleusercontent.com,android-dev.apps.googleusercontent.com,android-store.apps.googleusercontent.com`,
    );
    expect(googleClientIds(ANDROID_ONLY, GOOGLE)).toBe(`${GOOGLE.clientId},android-dev.apps.googleusercontent.com`);
  });

  it("skips Google's nonce check only once there is an iOS client", () => {
    expect(googleSkipsNonce(CONFIG)).toBe(false);
    expect(authSettings(CONFIG, GOOGLE)).toMatchObject({ external_google_skip_nonce_check: false });
    expect(googleSkipsNonce(ANDROID_ONLY)).toBe(false);
    expect(authSettings(NATIVE, GOOGLE)).toMatchObject({
      external_google_client_id: googleClientIds(NATIVE, GOOGLE),
      external_google_skip_nonce_check: true,
    });
  });

  it("catches a client list or nonce setting that doesn't read back", () => {
    const written = { ...authSettings(NATIVE, GOOGLE), external_google_secret: undefined };
    expect(authProblems(written, NATIVE, GOOGLE)).toEqual([]);
    expect(authProblems({ ...written, external_google_client_id: GOOGLE.clientId }, NATIVE, GOOGLE)).toEqual([
      "the Google client IDs aren't the ones given",
    ]);
    expect(authProblems({ ...written, external_google_skip_nonce_check: false }, NATIVE, GOOGLE)).toEqual([
      "Google's nonce check is on, not skipped (iOS)",
    ]);
    const web = { ...authSettings(CONFIG, GOOGLE), external_google_secret: undefined };
    expect(authProblems({ ...web, external_google_skip_nonce_check: true }, CONFIG, GOOGLE)).toEqual([
      "Google's nonce check is skipped, not on",
    ]);
  });

  it("finds the app's redirect URL among others", () => {
    const read = { ...authSettings(CONFIG, null), uri_allow_list: "http://localhost:3205/**, https://johns.glyn.dev/**" };
    expect(authProblems(read, CONFIG, null)).toEqual([]);
  });
});

describe("the Google console", () => {
  it("lists exactly what to paste", () => {
    const v = googleConsoleValues(CONFIG, REF);
    expect(v.redirectUris).toEqual([`https://${REF}.supabase.co/auth/v1/callback`, "http://127.0.0.1:54341/auth/v1/callback"]);
    expect(v.javascriptOrigins).toEqual(["https://johns.glyn.dev", "http://localhost:3205"]);
    expect(v.authorizedDomains).toEqual(["glyn.dev", "supabase.co"]);
    expect(v.privacyPolicy).toBe("https://johns.glyn.dev/privacy");
    expect(apexDomain("johns.glyn.dev")).toBe("glyn.dev");
  });

  it("checks where Supabase sends a browser to sign in", () => {
    const good = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE.clientId}&redirect_uri=${encodeURIComponent(`https://${REF}.supabase.co/auth/v1/callback`)}`;
    expect(authorizeProblems(good, REF, GOOGLE.clientId)).toEqual([]);
    expect(authorizeProblems(good.replace(GOOGLE.clientId, "env(AUTH_GOOGLE_CLIENT_ID)"), REF, GOOGLE.clientId)).toEqual([
      "the redirect carries a different Google client ID",
    ]);
    expect(authorizeProblems(null, REF, GOOGLE.clientId)).toEqual(["Supabase didn't redirect to Google"]);
  });

  it("reads Google's refusals by name", () => {
    expect(googleVerdict(400, "Error 400: redirect_uri_mismatch")).toBe("redirect_uri_mismatch");
    expect(googleVerdict(401, "Error 401: invalid_client The OAuth client was not found.")).toBe("invalid_client");
    expect(googleVerdict(302, "")).toBe("ok");
    expect(googleVerdict(500, "")).toBe("unknown");
  });
});

describe("keys and environment", () => {
  const keys = [
    { name: "anon", type: "legacy", api_key: "eyJ.anon" },
    { name: "service_role", type: "legacy", api_key: "eyJ.service" },
    { name: "default", type: "publishable", api_key: "sb_publishable_x" },
    { name: "default", type: "secret", api_key: "sb_secret_x" },
  ];

  it("prefers the keys local dev runs on, and falls back to the new ones", () => {
    expect(pickKeys(keys)).toEqual({ anon: "eyJ.anon", service: "eyJ.service" });
    expect(pickKeys(keys.slice(2))).toEqual({ anon: "sb_publishable_x", service: "sb_secret_x" });
    expect(pickKeys([])).toEqual({ anon: null, service: null });
  });

  it("keeps secrets sensitive and everything on production only", () => {
    const plan = envPlan(CONFIG, {
      supabaseUrl: `https://${REF}.supabase.co`,
      anonKey: "a",
      serviceKey: "s",
      cronSecret: "c",
      vapid: { publicKey: "p", privateKey: "k" },
    });
    const sensitive = plan.filter((e) => e.type === "sensitive").map((e) => e.key);
    expect(sensitive.sort()).toEqual(["CRON_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "VAPID_PRIVATE_KEY"]);
    expect(plan.every((e) => e.target.length === 1 && e.target[0] === "production")).toBe(true);
    expect(plan.find((e) => e.key === "NEXT_PUBLIC_SITE_URL")!.value).toBe("https://johns.glyn.dev");
  });

  it("leaves existing push keys alone, since new ones orphan every subscribed phone", () => {
    const plan = envPlan(CONFIG, { supabaseUrl: "u", anonKey: "a", serviceKey: "s", cronSecret: "c", vapid: null });
    expect(plan.some((e) => e.key.includes("VAPID_P"))).toBe(false);
  });
});

describe("the Vercel projects", () => {
  it("builds the Next app from apps/api, however the path is written", () => {
    expect(rootDirectoryProblem("apps/api", CONFIG.vercel)).toBeNull();
    expect(rootDirectoryProblem("./apps/api/", CONFIG.vercel)).toBeNull();
  });

  it("names where it builds from instead", () => {
    expect(rootDirectoryProblem(null, CONFIG.vercel)).toBe("johns builds from the repository root, not `apps/api`");
    expect(rootDirectoryProblem("", CONFIG.vercel)).toBe("johns builds from the repository root, not `apps/api`");
    expect(rootDirectoryProblem("apps/client", CONFIG.vercel)).toBe("johns builds from `apps/client`, not `apps/api`");
  });

  it("builds the web from apps/client", () => {
    expect(rootDirectoryProblem("apps/client", CONFIG.web)).toBeNull();
    expect(rootDirectoryProblem("apps/api", CONFIG.web)).toBe("johns-web builds from `apps/api`, not `apps/client`");
  });

  it("puts the site on the web build and apps/api on a name of its own", () => {
    expect(domainPlan(CONFIG)).toEqual([
      { project: "johns-web", domain: "johns.glyn.dev" },
      { project: "johns", domain: "api.johns.glyn.dev" },
    ]);
  });

  it("passes /api/* on to that same name", () => {
    const web = JSON.parse(readFileSync(new URL("../../apps/client/vercel.json", import.meta.url), "utf8"));
    const api = web.rewrites.find((r: { source: string }) => r.source === "/api/:path*");
    expect(new URL(api.destination).host).toBe(CONFIG.vercel.domain);
  });

  it("gives the web build public values only, and no API URL, since it calls its own origin", () => {
    const plan = webEnvPlan({ supabaseUrl: `https://${REF}.supabase.co`, anonKey: "a", vapidPublicKey: "p" });
    expect(plan.map((e) => [e.key, e.value])).toEqual([
      ["EXPO_PUBLIC_SUPABASE_URL", `https://${REF}.supabase.co`],
      ["EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "a"],
      ["EXPO_PUBLIC_VAPID_PUBLIC_KEY", "p"],
    ]);
    expect(plan.every((e) => e.type === "plain" && e.target.join() === "production")).toBe(true);
  });
});

describe("migrations and the Vault", () => {
  it("knows which migrations the database hasn't recorded", () => {
    const local = ["20261011000000_init.sql", "20261012000000_groups_and_away.sql"].map(migrationVersion);
    expect(local).toEqual(["20261011000000", "20261012000000"]);
    expect(missingMigrations(local as string[], ["20261011000000"])).toEqual(["20261012000000"]);
    expect(migrationVersion("README.md")).toBeNull();
  });

  it("quotes what goes into SQL", () => {
    const statement = vaultUpsertSql("johns_tick_secret", "it's");
    expect(statement).toContain("'it''s'");
    expect(statement).toContain("vault.update_secret");
  });
});

describe(".env files", () => {
  it("reads and rewrites a line without touching the rest", () => {
    const text = "# comment\nA=1\nB=\"two\"\n";
    expect(parseEnvFile(text)).toEqual({ A: "1", B: "two" });
    expect(setEnvLine(text, "A", "9")).toBe("# comment\nA=9\nB=\"two\"\n");
    expect(setEnvLine("A=1", "C", "3")).toBe("A=1\nC=3\n");
    expect(setEnvLine("", "C", "3")).toBe("C=3\n");
  });
});

describe("the run's summary", () => {
  const todo = [
    { title: "Connect the integration", url: "https://supabase.com/dashboard/project/x/settings/integrations" },
    {
      title: "Create the Google sign-in client",
      steps: googleSteps(CONFIG, REF),
      values: [["Authorised redirect URIs", googleConsoleValues(CONFIG, REF).redirectUris]] as [string, string[]][],
    },
  ];

  it("walks the Google console in order, each step on its own page", () => {
    const steps = googleSteps(CONFIG, REF);
    expect(steps.map((s) => s.url)).toEqual([
      "https://console.cloud.google.com/projectcreate",
      "https://console.cloud.google.com/auth/branding",
      "https://console.cloud.google.com/auth/audience",
      "https://console.cloud.google.com/auth/clients/create",
      undefined,
    ]);
    expect(steps[1].text).toContain("https://johns.glyn.dev/privacy");
  });

  it("makes every step a link and every value its own code span, for a phone", () => {
    const md = summaryMarkdown({
      app: "Johns",
      site: "https://johns.glyn.dev",
      results: [
        { ok: true, msg: "healthy" },
        { ok: false, msg: "Google refuses sign-in: invalid_client" },
      ],
      todo,
    });
    expect(md).toContain("## Johns: 1 check failed");
    expect(md).toContain("- ✅ healthy");
    expect(md).toContain("- ❌ Google refuses sign-in: invalid_client");
    expect(md).toContain("1. **Connect the integration** · [open](https://supabase.com/dashboard/project/x/settings/integrations)");
    expect(md).toContain("[Create a Google Cloud project called Johns](https://console.cloud.google.com/projectcreate)");
    expect(md).toContain(`\`https://${REF}.supabase.co/auth/v1/callback\``);
  });

  it("says why a run stopped early on the page a phone opens first", () => {
    const md = summaryMarkdown({
      app: "Johns",
      site: "https://johns.glyn.dev",
      results: [{ ok: false, msg: "no project called Johns yet" }],
      todo: [],
      stopped: "SUPABASE_ACCESS_TOKEN is not set.\nAdd it as a repository secret.",
    });
    expect(md).toContain("## Johns: stopped");
    expect(md).toContain("> SUPABASE_ACCESS_TOKEN is not set.\n> Add it as a repository secret.");
    expect(md).toContain("- ❌ no project called Johns yet");
  });

  it("names the token an API refused", () => {
    expect(tokenHint("https://api.supabase.com", 401)).toBe(" (check SUPABASE_ACCESS_TOKEN)");
    expect(tokenHint("https://api.vercel.com", 403)).toContain("VERCEL_TOKEN");
    expect(tokenHint("https://api.vercel.com", 404)).toBe("");
  });

  it("says the same in a terminal", () => {
    const text = todoText(todo);
    expect(text).toContain("- Connect the integration: https://supabase.com/dashboard/project/x/settings/integrations");
    expect(text).toContain("  3. Audience: External, then Publish app: https://console.cloud.google.com/auth/audience");
    expect(text).toContain(`Authorised redirect URIs: https://${REF}.supabase.co/auth/v1/callback`);
  });
});
