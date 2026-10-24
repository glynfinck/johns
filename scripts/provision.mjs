// Make production match scripts/provision/config.mjs, then prove it does.
//
//   npm run provision              do everything that can be done, then check
//   npm run provision -- --check   change nothing; read back and check
//   npm run provision -- --no-deploy
//
// Run it on your own machine: it needs tokens this repo must never hold.
// They come from the environment or from .env.provision.local (gitignored):
//
//   SUPABASE_ACCESS_TOKEN   supabase.com/dashboard/account/tokens
//   VERCEL_TOKEN            vercel.com/account/settings/tokens
//   GOOGLE_CLIENT_ID        from the Google console; leave both unset on the
//   GOOGLE_CLIENT_SECRET    first run and this prints what to paste there
//   SUPABASE_DB_PASSWORD    written here when this script creates the project
//
// Safe to run again and again: every step looks before it writes, and no
// secret it generates is ever printed.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CONFIG as C } from "./provision/config.mjs";
import {
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
  siteUrl,
  summaryMarkdown,
  todoText,
  vaultUpsertSql,
} from "./provision/lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_FILE = path.join(ROOT, ".env.provision.local");
const args = new Set(process.argv.slice(2));
const CHECK_ONLY = args.has("--check");
const DEPLOY = !CHECK_ONLY && !args.has("--no-deploy");
// Run from the "Provision production" workflow, the tokens are repository
// secrets and the summary is written to the run's page for a phone to read.
const IN_ACTIONS = Boolean(process.env.GITHUB_ACTIONS);
const SECRETS_PAGE = `https://github.com/${process.env.GITHUB_REPOSITORY ?? "glynfinck/johns"}/settings/secrets/actions`;

const env = { ...(existsSync(LOCAL_FILE) ? parseEnvFile(readFileSync(LOCAL_FILE, "utf8")) : {}), ...process.env };
const results = [];
const todo = [];

const say = (msg) => console.log(msg);
const pass = (msg) => (results.push({ ok: true, msg }), say(`  ✓ ${msg}`));
const fail = (msg) => (results.push({ ok: false, msg }), say(`  ✗ ${msg}`));
const step = (title) => say(`\n${title}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const secret = () => randomBytes(32).toString("base64url");
/** Keep a value out of the Actions log even if something were to print it. */
const mask = (value) => {
  if (IN_ACTIONS && value) console.log(`::add-mask::${value}`);
  return value;
};

function need(name, where) {
  if (!env[name]) {
    console.error(
      IN_ACTIONS
        ? `${name} is not set. Create one at ${where}, then add it as a repository secret: ${SECRETS_PAGE}/new`
        : `${name} is not set. Create one at ${where}, then put it in .env.provision.local or the environment.`,
    );
    process.exit(2);
  }
  return env[name];
}

/** JSON over HTTPS with a bearer token. Errors name the call, never the body sent. */
async function call(base, token, method, route, body) {
  const res = await fetch(base + route, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON: keep the text for the error.
  }
  if (!res.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`${method} ${route.split("?")[0]} → ${res.status}: ${detail.slice(0, 300)}`);
  }
  return data;
}

const SUPABASE_TOKEN = need("SUPABASE_ACCESS_TOKEN", "https://supabase.com/dashboard/account/tokens");
const VERCEL_TOKEN = need("VERCEL_TOKEN", "https://vercel.com/account/settings/tokens");
const supa = (method, route, body) => call("https://api.supabase.com", SUPABASE_TOKEN, method, route, body);
const team = `teamId=${C.vercel.teamId}`;
const vercel = (method, route, body) =>
  call("https://api.vercel.com", VERCEL_TOKEN, method, `${route}${route.includes("?") ? "&" : "?"}${team}`, body);

const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { clientId: env.GOOGLE_CLIENT_ID.trim(), secret: env.GOOGLE_CLIENT_SECRET.trim() }
    : null;

function supabaseCli(cliArgs) {
  execFileSync("supabase", cliArgs, {
    cwd: ROOT,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: SUPABASE_TOKEN },
  });
}

say(`Provisioning ${C.app} → ${siteUrl(C)}${CHECK_ONLY ? " (check only)" : ""}`);

// --- 1. The Supabase project -------------------------------------------------------

step("Supabase project");
const findProject = async () =>
  (await supa("GET", "/v1/projects")).find((p) => p.name === C.supabase.name && p.organization_id === C.supabase.orgId);
let project = await findProject();
if (!project && CHECK_ONLY) {
  fail(`no project called ${C.supabase.name} yet`);
  process.exit(1);
}
if (!project) {
  // The password is saved before the project exists, so a crash between the
  // two can't lose it. In a workflow it lives only for this run: everything
  // after creation goes through the API, and the dashboard can reset it.
  const password = mask(env.SUPABASE_DB_PASSWORD || secret());
  if (!env.SUPABASE_DB_PASSWORD && IN_ACTIONS) {
    env.SUPABASE_DB_PASSWORD = password;
    say("  · database password made for this run only (reset it in Supabase if you ever need it)");
  } else if (!env.SUPABASE_DB_PASSWORD) {
    const before = existsSync(LOCAL_FILE) ? readFileSync(LOCAL_FILE, "utf8") : "";
    writeFileSync(LOCAL_FILE, setEnvLine(before, "SUPABASE_DB_PASSWORD", password), { mode: 0o600 });
    env.SUPABASE_DB_PASSWORD = password;
    say("  · database password saved to .env.provision.local");
  }
  supabaseCli([
    "projects", "create", C.supabase.name,
    "--org-id", C.supabase.orgId,
    "--db-password", password,
    "--region", C.supabase.region,
    "--size", C.supabase.size,
  ]);
  project = await findProject();
  if (!project) throw new Error("the project was created but can't be found by name");
}
const ref = project.ref ?? project.id;
for (let i = 0; project.status !== "ACTIVE_HEALTHY"; i++) {
  if (i === 0) say(`  · waiting for ${ref} to come up (${project.status})`);
  if (i > 120) throw new Error(`${ref} is still ${project.status} after ten minutes`);
  await sleep(5000);
  project = await supa("GET", `/v1/projects/${ref}`);
}
pass(`${C.supabase.name} is ${ref} in ${project.region}, healthy`);
const supabaseUrl = `https://${ref}.supabase.co`;

/** SQL as the project's owner, through the Management API. */
const sql = (query) => supa("POST", `/v1/projects/${ref}/database/query`, { query });

// --- 2. Migrations ---------------------------------------------------------------

step("Database migrations");
const localVersions = readdirSync(path.join(ROOT, "supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .map(migrationVersion)
  .filter(Boolean)
  .sort();
const remoteVersions = async () => {
  try {
    return (await sql("select version from supabase_migrations.schema_migrations")).map((r) => r.version);
  } catch (e) {
    if (/does not exist/.test(String(e))) return [];
    throw e;
  }
};
let missing = missingMigrations(localVersions, await remoteVersions());
if (missing.length > 0 && !CHECK_ONLY) {
  if (env.SUPABASE_DB_PASSWORD) {
    say(`  · pushing ${missing.length} migration${missing.length === 1 ? "" : "s"}`);
    supabaseCli(["db", "push", "--project-ref", ref, "--password", env.SUPABASE_DB_PASSWORD, "--yes"]);
    missing = missingMigrations(localVersions, await remoteVersions());
  } else {
    todo.push({
      title: "Apply the migrations: connect the Supabase GitHub integration (glynfinck/johns, branch main), then run this again",
      url: `https://supabase.com/dashboard/project/${ref}/settings/integrations`,
    });
  }
}
if (missing.length === 0) pass(`all ${localVersions.length} migrations applied`);
else fail(`not applied yet: ${missing.join(", ")}`);
if (missing.length === 0) {
  todo.push({
    title: "If you haven't yet, connect the Supabase GitHub integration (glynfinck/johns, branch main) so later migrations deploy on merge",
    url: `https://supabase.com/dashboard/project/${ref}/settings/integrations`,
  });
}

// --- 3. The clock's Vault secrets -----------------------------------------------------

step("The clock (pg_cron → /api/cron/tick)");
const [existingSecret] = await sql(
  `select decrypted_secret from vault.decrypted_secrets where name = '${C.vault.secret}'`,
);
const cronSecret = mask(existingSecret?.decrypted_secret || secret());
if (!CHECK_ONLY) {
  await sql(vaultUpsertSql(C.vault.url, `${siteUrl(C)}/api/cron/tick`));
  await sql(vaultUpsertSql(C.vault.secret, cronSecret));
}
const vault = await sql(
  `select name, decrypted_secret from vault.decrypted_secrets where name in ('${C.vault.url}', '${C.vault.secret}')`,
);
const vaultUrl = vault.find((v) => v.name === C.vault.url)?.decrypted_secret;
if (vaultUrl === `${siteUrl(C)}/api/cron/tick`) pass(`${C.vault.url} points at ${vaultUrl}`);
else fail(`${C.vault.url} is ${vaultUrl ?? "missing"}`);
if (vault.find((v) => v.name === C.vault.secret)?.decrypted_secret) pass(`${C.vault.secret} is set`);
else fail(`${C.vault.secret} is missing`);
if (missing.length === 0) {
  const jobs = await sql(`select jobname from cron.job where jobname = '${C.cronJob}'`);
  if (jobs.length === 1) pass(`pg_cron runs ${C.cronJob} every ten minutes`);
  else fail(`pg_cron has no ${C.cronJob} job`);
}

// --- 4. Sign-in ---------------------------------------------------------------------

step("Sign-in (Supabase auth settings)");
if (!CHECK_ONLY) await supa("PATCH", `/v1/projects/${ref}/config/auth`, authSettings(C, google));
const auth = await supa("GET", `/v1/projects/${ref}/config/auth`);
const problems = authProblems(auth, C, google);
if (problems.length === 0) pass(`site URL ${siteUrl(C)}, email sign-up off${google ? ", Google on" : ""}`);
for (const p of problems) fail(p);
if (!google) {
  const v = googleConsoleValues(C, ref);
  todo.push({
    title: "Create the Google sign-in client (Google has no API for this part)",
    steps: googleSteps(C, ref, IN_ACTIONS ? `${SECRETS_PAGE}/new` : undefined),
    values: [
      ["Authorised JavaScript origins", v.javascriptOrigins],
      ["Authorised redirect URIs", v.redirectUris],
    ],
  });
} else if (!CHECK_ONLY && existsSync(path.join(ROOT, ".env.local"))) {
  // Local sign-in uses the same client, through config.toml's env() names.
  let local = readFileSync(path.join(ROOT, ".env.local"), "utf8");
  local = setEnvLine(local, "AUTH_GOOGLE_CLIENT_ID", google.clientId);
  local = setEnvLine(local, "AUTH_GOOGLE_SECRET", google.secret);
  writeFileSync(path.join(ROOT, ".env.local"), local);
  say("  · .env.local has the Google client for local sign-in (restart supabase to pick it up)");
}

// --- 5. Vercel ------------------------------------------------------------------------

step("Vercel");
const vercelProject = await vercel("GET", `/v9/projects/${C.vercel.project}`);
const repoId = vercelProject.link?.repoId;
if (repoId) pass(`${C.vercel.project} deploys from ${vercelProject.link.org}/${vercelProject.link.repo}`);
else fail(`${C.vercel.project} isn't connected to its GitHub repository`);

const keys = pickKeys(await supa("GET", `/v1/projects/${ref}/api-keys?reveal=true`));
if (!keys.anon || !keys.service) throw new Error("Supabase returned no usable API keys for the project");
mask(keys.service);
const existing = (await vercel("GET", `/v10/projects/${vercelProject.id}/env`)).envs ?? [];
const has = (key) => existing.some((e) => e.key === key && e.target?.includes("production"));
let vapid = null;
if (!(has("NEXT_PUBLIC_VAPID_PUBLIC_KEY") && has("VAPID_PRIVATE_KEY"))) {
  const { default: webpush } = await import("web-push");
  vapid = webpush.generateVAPIDKeys();
  mask(vapid.privateKey);
}
const plan = envPlan(C, { supabaseUrl, anonKey: keys.anon, serviceKey: keys.service, cronSecret, vapid });
if (!CHECK_ONLY) await vercel("POST", `/v10/projects/${vercelProject.id}/env?upsert=true`, plan);
const after = (await vercel("GET", `/v10/projects/${vercelProject.id}/env`)).envs ?? [];
const absent = [...plan.map((e) => e.key), "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"].filter(
  (key) => !after.some((e) => e.key === key && e.target?.includes("production")),
);
if (absent.length === 0) pass(`production has its ${plan.length + (vapid ? 0 : 2)} environment variables`);
else fail(`production is missing ${absent.join(", ")}`);
const domains = (await vercel("GET", `/v9/projects/${vercelProject.id}/domains`)).domains ?? [];
if (domains.some((d) => d.name === C.domain && d.verified)) pass(`${C.domain} is attached and verified`);
else fail(`${C.domain} isn't attached to ${C.vercel.project}, or isn't verified`);

if (DEPLOY && repoId) {
  say("  · deploying main to production");
  let deployment = await vercel("POST", "/v13/deployments?forceNew=1", {
    name: C.vercel.project,
    project: vercelProject.id,
    target: "production",
    gitSource: { type: "github", repoId, ref: "main" },
  });
  for (let i = 0; !["READY", "ERROR", "CANCELED"].includes(deployment.readyState); i++) {
    if (i > 120) throw new Error("the deployment is still building after ten minutes");
    await sleep(5000);
    deployment = await vercel("GET", `/v13/deployments/${deployment.id}`);
  }
  if (deployment.readyState === "READY") pass(`deployed (${deployment.url})`);
  else fail(`the deployment ended ${deployment.readyState}: https://vercel.com/${vercelProject.accountId}/${C.vercel.project}`);
}

// --- 6. End to end ------------------------------------------------------------------------

step("End to end");
const page = await fetch(`${siteUrl(C)}/signin`).catch(() => null);
if (page?.ok) pass(`${siteUrl(C)}/signin answers ${page.status}`);
else fail(`${siteUrl(C)}/signin answers ${page?.status ?? "nothing"}`);

const tick = await fetch(`${siteUrl(C)}/api/cron/tick`, {
  method: "POST",
  headers: { Authorization: `Bearer ${cronSecret}` },
}).catch(() => null);
if (tick?.ok) pass("the clock's tick is accepted, so Vercel and the Vault share one secret");
else fail(`the clock's tick answers ${tick?.status ?? "nothing"}`);

if (google) {
  const start = await fetch(
    `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(`${siteUrl(C)}/auth/callback`)}`,
    { redirect: "manual" },
  );
  const location = start.headers.get("location");
  const hops = authorizeProblems(location, ref, google.clientId);
  for (const p of hops) fail(p);
  if (hops.length === 0) {
    const answer = await fetch(location, { redirect: "manual" });
    const verdict = googleVerdict(answer.status, answer.status >= 400 ? await answer.text() : "");
    if (verdict === "ok") pass("Google accepts the client and the redirect (the secret is only proved by a real sign-in)");
    else if (verdict === "unknown") fail(`Google answered ${answer.status}; sign in once at ${siteUrl(C)}/signin to see why`);
    else fail(`Google refuses sign-in: ${verdict}`);
  }
}

// --- Summary ------------------------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
say(`\n${results.length - failed.length} checks passed, ${failed.length} failed.`);
if (todo.length > 0) say(`\nStill yours to do:\n${todoText(todo)}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown({ app: C.app, site: siteUrl(C), results, todo }));
}
process.exit(failed.length > 0 ? 1 : 0);
