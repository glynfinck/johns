import { normaliseJoinCode } from "@app/core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OPTIONS, POST } from "@/app/api/fresh/route";
import { adminClient, signedInUser, type Actor } from "@/tests/support/clients";
import { makeHouse, type House } from "@/tests/support/factories";

/**
 * POST /api/fresh, called the way the app calls it: a bearer token and a
 * house id. The handler runs here against the local stack, so what it lets
 * through is what production would.
 */

const URL = "http://localhost:3205/api/fresh";
const db = adminClient();

async function tokenOf(actor: Actor): Promise<string> {
  const { data } = await actor.db.auth.getSession();
  return data.session!.access_token;
}

function call(body: unknown, token?: string, origin?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (origin) headers.origin = origin;
  return POST(new Request(URL, { method: "POST", headers, body: JSON.stringify(body) }));
}

async function tickedAt(houseId: string): Promise<string | null> {
  const { data } = await db.from("houses").select("ticked_at").eq("id", houseId).single();
  return data!.ticked_at;
}

let house: House;
let stranger: Actor;
const savedOrigins = process.env.ALLOWED_ORIGINS;

beforeAll(() => {
  process.env.ALLOWED_ORIGINS = "http://localhost:8205";
});

// Each test's rows go at its end (tests/db/setup.ts), so each makes its own.
beforeEach(async () => {
  house = await makeHouse(["Ava", "Ben"]);
  stranger = await signedInUser("Zed");
});

afterAll(() => {
  process.env.ALLOWED_ORIGINS = savedOrigins;
});

describe("POST /api/fresh", () => {
  it("refuses a caller with no token, or a token Supabase didn't sign", async () => {
    const none = await call({ houseId: house.id });
    expect(none.status).toBe(401);
    expect(await none.json()).toEqual({ error: "Sign in first." });

    const forged = await call({ houseId: house.id }, "not.a.token");
    expect(forged.status).toBe(401);
    expect(await tickedAt(house.id)).toBeNull();
  });

  it("refuses a body that doesn't name a house", async () => {
    const token = await tokenOf(house.admin);
    expect((await call({}, token)).status).toBe(400);
    expect((await call({ houseId: "not-a-uuid" }, token)).status).toBe(400);
    const garbage = await POST(
      new Request(URL, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: "{" }),
    );
    expect(garbage.status).toBe(400);
  });

  it("refuses to catch up someone else's house, and doesn't tick it", async () => {
    const response = await call({ houseId: house.id }, await tokenOf(stranger));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "That isn't in your house." });
    expect(await tickedAt(house.id)).toBeNull();
  });

  it("catches a housemate's house up, then not again within a minute", async () => {
    const first = await call({ houseId: house.id }, await tokenOf(house.members[0]));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ticked: true });
    const stamped = await tickedAt(house.id);
    expect(stamped).not.toBeNull();

    const second = await call({ houseId: house.id }, await tokenOf(house.admin));
    expect(await second.json()).toEqual({ ticked: false });
    expect(await tickedAt(house.id)).toBe(stamped);
  });

  it("answers the Expo web build's origin with CORS, and nobody else's", async () => {
    const token = await tokenOf(house.admin);
    const allowed = await call({ houseId: house.id }, token, "http://localhost:8205");
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:8205");
    const other = await call({ houseId: house.id }, token, "https://evil.example");
    expect(other.headers.get("access-control-allow-origin")).toBeNull();

    const pre = OPTIONS(new Request(URL, { method: "OPTIONS", headers: { origin: "http://localhost:8205" } }));
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-headers")).toBe("Authorization, Content-Type");
  });
});

describe("join codes", () => {
  it("are ones the app's join-code check accepts", async () => {
    const codes = [house.code];
    for (let i = 0; i < 5; i += 1) codes.push((await makeHouse([`Owner ${i}`])).code);
    for (const code of codes) expect(normaliseJoinCode(code)).toBe(code);
  });
});
