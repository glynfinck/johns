import { describe, expect, it } from "vitest";

import { CONFIG } from "@/scripts/provision/config.mjs";
import {
  apexDomain,
  authProblems,
  authSettings,
  authorizeProblems,
  envPlan,
  googleConsoleValues,
  googleSteps,
  googleVerdict,
  migrationVersion,
  missingMigrations,
  parseEnvFile,
  pickKeys,
  setEnvLine,
  summaryMarkdown,
  todoText,
  tokenHint,
  vaultUpsertSql,
} from "@/scripts/provision/lib.mjs";

/**
 * The decisions `npm run provision` makes before it calls anything. The
 * failures pub-golf hit all reported success on the way in, so most of these
 * are about reading back and refusing what only looks right.
 */

const GOOGLE = { clientId: "123-abc.apps.googleusercontent.com", secret: "shh" };
const REF = "abcdefghijklmnopqrst";

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
