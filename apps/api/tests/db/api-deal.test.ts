import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { OPTIONS, POST } from "@/app/api/deal/route";
import { adminClient, signedInUser, type Actor } from "@/tests/support/clients";
import { addJohns, makeHouse, thisWeek } from "@/tests/support/factories";

/**
 * POST /api/deal, called as the app calls it: a bearer token and JSON.
 * deal_week is the engine's, so the route's own check is all that stands
 * between a housemate and re-dealing the house: these prove it holds.
 */

const BASE = "http://localhost:3205/api/deal";
const db = adminClient();
const savedOrigins = process.env.ALLOWED_ORIGINS;

beforeAll(() => {
  process.env.ALLOWED_ORIGINS = "http://localhost:8205";
});

afterAll(() => {
  process.env.ALLOWED_ORIGINS = savedOrigins;
});

async function dealAs(actor: Actor | undefined, body: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json", origin: "http://localhost:8205" };
  if (actor) {
    const { data } = await actor.db.auth.getSession();
    headers.authorization = `Bearer ${data.session!.access_token}`;
  }
  return POST(new Request(BASE, { method: "POST", headers, body: JSON.stringify(body) }));
}

/** This week's deal in the house: its John names, by who has them. */
async function dealtIn(houseId: string) {
  const { data: week } = await db.from("weeks").select("id").eq("house_id", houseId).eq("starts_on", thisWeek().startsOn).maybeSingle();
  if (!week) return null;
  const { data } = await db.from("assignments").select("id, name, user_id").eq("week_id", week.id).order("name");
  return data!;
}

describe("POST /api/deal", () => {
  it("refuses a caller with no token", async () => {
    const res = await dealAs(undefined, { houseId: crypto.randomUUID() });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in first." });
  });

  it("asks which house", async () => {
    const house = await makeHouse(["Ava"]);
    const res = await dealAs(house.admin, { houseId: "flat-3" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Say which house to deal." });
  });

  it("refuses anyone outside the house, and deals nothing", async () => {
    const house = await makeHouse(["Ava", "Ben"]);
    await addJohns(house.id, [{ name: "Bins" }], thisWeek());
    const stranger = await signedInUser("Zed");
    const res = await dealAs(stranger, { houseId: house.id });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "That isn't in your house." });
    expect(await dealtIn(house.id)).toBeNull();
  });

  it("is for admins only", async () => {
    const house = await makeHouse(["Ava", "Ben"]);
    await addJohns(house.id, [{ name: "Bins" }], thisWeek());
    const res = await dealAs(house.members[0], { houseId: house.id });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Only the house admins can do that." });
    expect(await dealtIn(house.id)).toBeNull();
  });

  it("needs a John to hand out", async () => {
    const house = await makeHouse(["Ava", "Ben"]);
    const res = await dealAs(house.admin, { houseId: house.id });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Add at least one John first." });
  });

  it("hands out the first week, and starts the house", async () => {
    const house = await makeHouse(["Ava", "Ben"]);
    await addJohns(house.id, [{ name: "Bins" }, { name: "Bathroom" }], thisWeek());
    const res = await dealAs(house.admin, { houseId: house.id });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:8205");
    expect(await res.json()).toEqual({ ok: true });

    const dealt = await dealtIn(house.id);
    expect(dealt!.map((a) => a.name)).toEqual(["Bathroom", "Bins"]);
    // Two Johns of the same effort, two people: one each.
    expect(new Set(dealt!.map((a) => a.user_id)).size).toBe(2);
    const { data: h } = await db.from("houses").select("first_dealt_at").eq("id", house.id).single();
    expect(h!.first_dealt_at).not.toBeNull();
  });

  it("re-deals a week nobody has ticked in, with a John added since", async () => {
    const house = await makeHouse(["Ava", "Ben"]);
    await addJohns(house.id, [{ name: "Bins" }], thisWeek());
    expect((await dealAs(house.admin, { houseId: house.id })).status).toBe(200);
    await addJohns(house.id, [{ name: "Hoover" }], thisWeek());

    const res = await dealAs(house.admin, { houseId: house.id });
    expect(res.status).toBe(200);
    expect((await dealtIn(house.id))!.map((a) => a.name)).toEqual(["Bins", "Hoover"]);
  });

  it("won't re-deal once a John is ticked", async () => {
    const house = await makeHouse(["Ava", "Ben"]);
    await addJohns(house.id, [{ name: "Bins" }, { name: "Bathroom" }], thisWeek());
    expect((await dealAs(house.admin, { houseId: house.id })).status).toBe(200);
    const before = await dealtIn(house.id);
    const ticked = before![0];
    const owner = house.everyone.find((a) => a.userId === ticked.user_id)!;
    const { error } = await owner.db.rpc("mark_done", { p_assignment: ticked.id });
    expect(error).toBeNull();

    const res = await dealAs(house.admin, { houseId: house.id });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Someone's already ticked a John this week, so it can't be re-dealt." });
    expect(await dealtIn(house.id)).toEqual(before);
  });

  it("answers a browser's preflight", () => {
    const res = OPTIONS(new Request(BASE, { method: "OPTIONS", headers: { origin: "http://localhost:8205" } }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:8205");
  });
});
