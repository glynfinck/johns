// The decisions `npm run provision` makes, as pure functions so a unit test
// can hold them (tests/unit/provision.test.ts). Everything that talks to an
// API lives in scripts/provision.mjs.

export const siteUrl = (c) => `https://${c.domain}`;

/** The registrable domain Google's consent screen authorises: glyn.dev for johns.glyn.dev. */
export const apexDomain = (domain) => domain.split(".").slice(-2).join(".");

/**
 * Production's auth settings. Only these fields are sent, never the local
 * config: `supabase config push` would write localhost over the site URL and
 * turn email sign-up back on.
 */
export function authSettings(c, google) {
  const body = {
    site_url: siteUrl(c),
    uri_allow_list: `${siteUrl(c)}/**`,
    external_email_enabled: false,
  };
  if (google) {
    body.external_google_enabled = true;
    body.external_google_client_id = google.clientId;
    body.external_google_secret = google.secret;
  }
  return body;
}

/**
 * What is wrong with the auth settings as read back. Each failure here once
 * reported success on the way in, so nothing counts as done until it reads
 * back right.
 */
export function authProblems(actual, c, google) {
  const problems = [];
  if (actual.site_url !== siteUrl(c)) problems.push(`site URL is ${actual.site_url || "unset"}, not ${siteUrl(c)}`);
  const allowed = String(actual.uri_allow_list ?? "")
    .split(",")
    .map((s) => s.trim());
  if (!allowed.includes(`${siteUrl(c)}/**`)) problems.push(`redirect URLs don't include ${siteUrl(c)}/**`);
  if (actual.external_email_enabled) problems.push("email sign-up is still on");
  if (google) {
    const id = String(actual.external_google_client_id ?? "");
    if (!actual.external_google_enabled) problems.push("Google sign-in is off");
    if (id.startsWith("env(")) problems.push(`the Google client ID is the unresolved placeholder ${id}`);
    else if (id !== google.clientId) problems.push("the Google client ID isn't the one given");
  }
  return problems;
}

/** What to paste into the Google console, which has no API for any of it. */
export function googleConsoleValues(c, ref) {
  return {
    redirectUris: [
      `https://${ref}.supabase.co/auth/v1/callback`,
      `http://127.0.0.1:${c.local.apiPort}/auth/v1/callback`,
    ],
    javascriptOrigins: [siteUrl(c), `http://localhost:${c.local.appPort}`],
    authorizedDomains: [apexDomain(c.domain), "supabase.co"],
    homePage: siteUrl(c),
    privacyPolicy: `${siteUrl(c)}/privacy`,
  };
}

/**
 * The browser key and the server key. Prefers the legacy JWT keys, which is
 * what local dev runs on, and falls back to the publishable and secret keys a
 * newer project may have instead.
 */
export function pickKeys(keys) {
  const legacy = (name) => keys.find((k) => k.type === "legacy" && k.name === name && k.api_key);
  const anon = legacy("anon") ?? keys.find((k) => k.type === "publishable" && k.api_key);
  const service = legacy("service_role") ?? keys.find((k) => k.type === "secret" && k.api_key);
  return { anon: anon?.api_key ?? null, service: service?.api_key ?? null };
}

/**
 * Vercel's production environment. Previews get nothing: Johns has no
 * preview database, and a preview writing to production's would be worse
 * than one that doesn't start. `vapid` is null when the existing keys stay,
 * since new ones would orphan every phone already subscribed.
 */
export function envPlan(c, { supabaseUrl, anonKey, serviceKey, cronSecret, vapid }) {
  const plain = (key, value) => ({ key, value, type: "plain", target: ["production"] });
  const secret = (key, value) => ({ key, value, type: "sensitive", target: ["production"] });
  const plan = [
    plain("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
    plain("NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey),
    secret("SUPABASE_SERVICE_ROLE_KEY", serviceKey),
    plain("NEXT_PUBLIC_SITE_URL", siteUrl(c)),
    secret("CRON_SECRET", cronSecret),
    plain("VAPID_SUBJECT", siteUrl(c)),
  ];
  if (vapid) {
    plan.push(plain("NEXT_PUBLIC_VAPID_PUBLIC_KEY", vapid.publicKey), secret("VAPID_PRIVATE_KEY", vapid.privateKey));
  }
  return plan;
}

/** Local migrations the database hasn't recorded, by version. */
export function missingMigrations(localVersions, remoteVersions) {
  const applied = new Set(remoteVersions);
  return localVersions.filter((v) => !applied.has(v));
}

/** The version a migration file name starts with: 20261012000000_groups.sql → 20261012000000. */
export const migrationVersion = (file) => file.match(/^(\d+)_/)?.[1] ?? null;

export const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;

/** Create a Vault secret, or overwrite it if it exists. */
export function vaultUpsertSql(name, value) {
  return `do $provision$
declare existing uuid;
begin
  select id into existing from vault.secrets where name = ${sqlString(name)};
  if existing is null then
    perform vault.create_secret(${sqlString(value)}, ${sqlString(name)});
  else
    perform vault.update_secret(existing, ${sqlString(value)});
  end if;
end
$provision$;`;
}

/**
 * Where Supabase sends a browser to start Google sign-in, checked without a
 * browser: it must go to Google, with this client, back to this project.
 */
export function authorizeProblems(location, ref, clientId) {
  if (!location) return ["Supabase didn't redirect to Google"];
  let url;
  try {
    url = new URL(location);
  } catch {
    return [`Supabase redirected somewhere unreadable: ${location}`];
  }
  const problems = [];
  if (url.hostname !== "accounts.google.com") problems.push(`Supabase redirected to ${url.hostname}, not Google`);
  if (url.searchParams.get("client_id") !== clientId) problems.push("the redirect carries a different Google client ID");
  const back = `https://${ref}.supabase.co/auth/v1/callback`;
  if (url.searchParams.get("redirect_uri") !== back) problems.push(`Google is told to return to ${url.searchParams.get("redirect_uri")}, not ${back}`);
  return problems;
}

/**
 * What Google said about the sign-in request. It refuses an unknown client or
 * an unregistered redirect on the spot, by name, before anyone signs in.
 */
export function googleVerdict(status, body) {
  if (/redirect_uri_mismatch/i.test(body)) return "redirect_uri_mismatch";
  if (/invalid_client|OAuth client was not found|deleted_client/i.test(body)) return "invalid_client";
  if (status >= 200 && status < 400) return "ok";
  return "unknown";
}

/** KEY=value lines, as in .env files. Quotes are stripped; comments and blanks skipped. */
export function parseEnvFile(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

/** Set KEY=value in .env text, replacing the line if the key is there. */
export function setEnvLine(text, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) return text.replace(re, line);
  return `${text}${text === "" || text.endsWith("\n") ? "" : "\n"}${line}\n`;
}
