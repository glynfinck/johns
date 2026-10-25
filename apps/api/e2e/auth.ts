import { randomUUID } from "node:crypto";

import { weekIndex, weekWindow } from "@app/core";
import type { BrowserContext } from "@playwright/test";
import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { dealWeek, loadHouse } from "../lib/engine/tick";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = "http://localhost:3205";
/** The Expo app's web build, served from its static export (playwright.config.ts). */
export const CLIENT_URL = "http://localhost:8205";

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error(
    "E2E needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and " +
      "SUPABASE_SERVICE_ROLE_KEY in apps/api/.env.local (run `supabase start`).",
  );
}

/** Local-only, and never a real credential: these users exist for one run. */
const PASSWORD = "e2e-not-a-secret-password";

export function admin() {
  return createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Put a signed-in housemate into `context`.
 *
 * Sign-in is Google-only and a consent screen cannot be driven from CI, so
 * the session is minted out of band: a confirmed user from the admin API,
 * real tokens from a password sign-in, and the cookies handed to the
 * browser. @supabase/ssr serializes them against an in-memory jar, so their
 * names and encoding always match what the app reads back.
 */
export async function signInAs(context: BrowserContext, name: string): Promise<string> {
  const { email, id } = await createHousemate(name);

  const jar = new Map<string, string>();
  const client = createBrowserClient(SUPABASE_URL!, ANON_KEY!, {
    isSingleton: false,
    cookies: {
      getAll: () => [...jar].map(([cookieName, value]) => ({ name: cookieName, value })),
      setAll: (cookies) => {
        for (const { name: cookieName, value } of cookies) jar.set(cookieName, value);
      },
    },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  await context.addCookies([...jar].map(([cookieName, value]) => ({ name: cookieName, value, url: BASE_URL })));
  return id;
}

/**
 * The same, for the Expo app's web build, which keeps its session where
 * supabase-js does in a browser: localStorage, not cookies. The tokens come
 * from a client with the app's URL and key, so the entry's name is the one the
 * app reads back. It is written before the app's first page load and only
 * once per tab, so a test that signs out stays signed out across reloads.
 */
export async function signInToClient(context: BrowserContext, name: string): Promise<string> {
  return (await clientSession(context, name)).id;
}

/** signInToClient's session, with a supabase-js client signed in as the same person. */
async function clientSession(context: BrowserContext, name: string): Promise<{ id: string; client: SupabaseClient }> {
  const { email, id } = await createHousemate(name);

  const store = new Map<string, string>();
  const client = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: true,
      storage: {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => void store.set(key, value),
        removeItem: (key) => void store.delete(key),
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;

  await context.addInitScript(
    ({ origin, entries }: { origin: string; entries: [string, string][] }) => {
      if (window.location.origin !== origin || sessionStorage.getItem("e2e-session-minted")) return;
      for (const [key, value] of entries) localStorage.setItem(key, value);
      sessionStorage.setItem("e2e-session-minted", "1");
    },
    { origin: CLIENT_URL, entries: [...store] },
  );
  return { id, client };
}

/**
 * Someone signed in to the Expo app's web build, in a house of their own
 * with this week already handed out: they create the house as the app does,
 * any `housemates` join it by its code (each signed in to their own
 * context), its Johns are added as an admin adds them, and the week is dealt
 * through the engine, as "Hand out this week's Johns" does. Alone, every John
 * lands on them; with housemates, the deal shares them out.
 */
export async function dealtHouseInClient(
  context: BrowserContext,
  name: string,
  houseName: string,
  johns: { name: string; category?: string; needsPhoto?: boolean }[],
  housemates: { context: BrowserContext; name: string }[] = [],
): Promise<{ userId: string; houseId: string; housemateIds: string[] }> {
  const { id, client } = await clientSession(context, name);
  const { data: houseId, error } = await client.rpc("create_house", {
    p_name: houseName,
    p_timezone: "Europe/London",
    p_currency: "GBP",
    p_week_starts: 1,
  });
  if (error) throw error;

  const db = admin();
  const { data: codeRow } = await db.from("houses").select("join_code").eq("id", houseId).single();
  const housemateIds: string[] = [];
  for (const mate of housemates) {
    const joiner = await clientSession(mate.context, mate.name);
    const { error: joinError } = await joiner.client.rpc("join_house", { p_code: codeRow!.join_code });
    if (joinError) throw joinError;
    housemateIds.push(joiner.id);
  }

  const now = new Date();
  const week = weekWindow(now, "Europe/London", 1);
  const { error: johnsError } = await db.from("johns").insert(
    johns.map((j) => ({
      house_id: houseId,
      name: j.name,
      category: j.category ?? "other",
      points: 2,
      // Sunday night: anything already due when the week is dealt gets a day's grace.
      due_dow: 7,
      due_time: "21:00",
      every_weeks: 1,
      anchor_week: weekIndex(week.startsOn),
      needs_photo: j.needsPhoto ?? false,
    })),
  );
  if (johnsError) throw johnsError;
  const { house, members } = await loadHouse(db, houseId);
  const { weekId } = await dealWeek(db, house, members, week, now, false);
  if (!weekId) throw new Error("Nothing was dealt");
  return { userId: id, houseId, housemateIds };
}

/**
 * A house set up by someone else, the way the app does it (create_house as
 * them), for a test to join by its code. Their id goes to `cleanUp` with the
 * test's own users, which takes the house with it.
 */
export async function houseOf(owner: string, houseName: string): Promise<{ ownerId: string; code: string }> {
  const { email, id } = await createHousemate(owner);
  const client = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  const { data: houseId, error } = await client.rpc("create_house", {
    p_name: houseName,
    p_timezone: "Europe/London",
    p_currency: "GBP",
    p_week_starts: 1,
  });
  if (error) throw error;
  const { data } = await admin().from("houses").select("join_code").eq("id", houseId).single();
  return { ownerId: id, code: data!.join_code };
}

/** A confirmed user with a password, named as housemates will see them. */
async function createHousemate(name: string): Promise<{ email: string; id: string }> {
  const email = `e2e-${randomUUID()}@test.local`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error) throw error;
  return { email, id: data.user.id };
}

/** Scoped teardown: the houses these users made, then the users. */
export async function cleanUp(userIds: string[]) {
  const db = admin();
  await db.from("houses").delete().in("created_by", userIds);
  for (const id of userIds) await db.auth.admin.deleteUser(id);
}
