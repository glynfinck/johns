import { DRAFTS_PER_DAY, guessStarter, HouseDraft, starterDraft } from "@app/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { OPTIONS, POST } from "@/app/api/setup/draft/route";
import type { DraftContext } from "@/lib/ai/house-draft";
import { draftHouse } from "@/lib/moves/draft";
import { adminClient, signedInUser, type Actor } from "@/tests/support/clients";
import { makeHouse } from "@/tests/support/factories";

/**
 * POST /api/setup/draft, called as the app calls it, and the move behind
 * it with Claude stood in for. Claude itself is never called here: without
 * the AI Gateway (no Vercel, no AI_GATEWAY_API_KEY) the route offers a
 * starter list, which is also what production does when the gateway is down.
 */

const BASE = "http://localhost:3205/api/setup/draft";
const db = adminClient();
const saved = { origins: process.env.ALLOWED_ORIGINS, key: process.env.AI_GATEWAY_API_KEY, vercel: process.env.VERCEL };

beforeAll(() => {
  process.env.ALLOWED_ORIGINS = "http://localhost:8205";
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL;
});

afterAll(() => {
  process.env.ALLOWED_ORIGINS = saved.origins;
  if (saved.key) process.env.AI_GATEWAY_API_KEY = saved.key;
  if (saved.vercel) process.env.VERCEL = saved.vercel;
});

async function draftAs(actor: Actor | undefined, body: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json", origin: "http://localhost:8205" };
  if (actor) {
    const { data } = await actor.db.auth.getSession();
    headers.authorization = `Bearer ${data.session!.access_token}`;
  }
  return POST(new Request(BASE, { method: "POST", headers, body: JSON.stringify(body) }));
}

async function draftsIn(houseId: string) {
  const { data } = await db.from("house_drafts").select("outcome, johns, input_tokens, output_tokens, user_id").eq("house_id", houseId);
  return data!;
}

const A_HOUSE = "Me, Ben and Cal in a terrace. Bins go out Tuesday night.";

describe("POST /api/setup/draft", () => {
  it("refuses a caller with no token", async () => {
    const res = await draftAs(undefined, { houseId: crypto.randomUUID(), description: A_HOUSE });
    expect(res.status).toBe(401);
  });

  it("asks for a little more than a word", async () => {
    const house = await makeHouse(["Ava"]);
    const res = await draftAs(house.admin, { houseId: house.id, description: "flat" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Say a little more/);
  });

  it("refuses anyone outside the house", async () => {
    const house = await makeHouse(["Ava"]);
    const res = await draftAs(await signedInUser("Zed"), { houseId: house.id, description: A_HOUSE });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "That isn’t in your house." });
  });

  it("is for admins only", async () => {
    const house = await makeHouse(["Ava", "Ben"]);
    const res = await draftAs(house.members[0], { houseId: house.id, description: A_HOUSE });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Only the house admins can do that." });
  });

  it("offers a starter list that fits when Claude isn't set up, adds nothing and counts nothing", async () => {
    const house = await makeHouse(["Ava"]);
    const res = await draftAs(house.admin, { houseId: house.id, description: "Me, my husband and the kids" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ draft: starterDraft("family"), source: "starter" });
    expect(await draftsIn(house.id)).toEqual([]);
    const { count } = await db.from("johns").select("id", { count: "exact", head: true }).eq("house_id", house.id);
    expect(count).toBe(0);
  });

  it("answers a browser's preflight", async () => {
    const res = OPTIONS(new Request(BASE, { method: "OPTIONS", headers: { origin: "http://localhost:8205" } }));
    expect(res.status).toBe(204);
  });
});

describe("draftHouse, with Claude stood in for", () => {
  const answer = {
    raw: {
      groups: [{ name: "Upstairs", members: ["me", "Ben", "Priya"] }],
      johns: [
        { name: "Upstairs bathroom", category: "bathroom", points: 4, group: "Upstairs" },
        { name: "Bins out", category: "bins", points: 1, dueDow: 2, dueTime: "21:00" },
      ],
      note: "I guessed the bins go out Tuesday night.",
    },
    inputTokens: 1200,
    outputTokens: 600,
  };

  it("tells Claude who's in the house, the asker first, and tidies what comes back", async () => {
    const house = await makeHouse(["Ava", "Ben"]);
    let told: DraftContext | null = null;
    const result = await draftHouse({ db: house.admin.db, userId: house.admin.userId }, house.id, A_HOUSE, new Date(), async (ctx) => {
      told = ctx;
      return answer;
    });
    expect(told).toEqual({ description: A_HOUSE, people: [house.admin.name.split(" ")[0], house.members[0].name.split(" ")[0]], weekStarts: 1 });
    if ("refusal" in result) throw new Error("refused");
    expect(result.source).toBe("ai");
    expect(HouseDraft.parse(result.draft).johns).toHaveLength(2);
    expect(result.draft.groups).toEqual([{ name: "Upstairs", memberIds: [house.admin.userId, house.members[0].userId], waitingFor: ["Priya"] }]);
    expect(await draftsIn(house.id)).toEqual([
      { outcome: "ai", johns: 2, input_tokens: 1200, output_tokens: 600, user_id: house.admin.userId },
    ]);
  });

  it("offers a starter list when Claude doesn't answer, and counts the try", async () => {
    const house = await makeHouse(["Ava"]);
    const result = await draftHouse({ db: house.admin.db, userId: house.admin.userId }, house.id, A_HOUSE, new Date(), async () => {
      throw new Error("overloaded");
    });
    expect(result).toEqual({ draft: starterDraft(guessStarter(A_HOUSE)), source: "starter" });
    expect((await draftsIn(house.id)).map((d) => d.outcome)).toEqual(["failed"]);
  });

  it(`stops at ${DRAFTS_PER_DAY} drafts a day for a house, counting only the last day`, async () => {
    const house = await makeHouse(["Ava"]);
    const now = new Date();
    const old = new Date(now.getTime() - 25 * 3600_000).toISOString();
    const recent = new Date(now.getTime() - 3600_000).toISOString();
    const { error } = await db.from("house_drafts").insert([
      ...Array.from({ length: DRAFTS_PER_DAY - 1 }, () => ({ house_id: house.id, outcome: "ai", created_at: recent })),
      { house_id: house.id, outcome: "ai", created_at: old },
    ]);
    expect(error).toBeNull();
    const caller = { db: house.admin.db, userId: house.admin.userId };
    const ask = async () => answer;
    expect("draft" in (await draftHouse(caller, house.id, A_HOUSE, now, ask))).toBe(true);
    expect(await draftHouse(caller, house.id, A_HOUSE, now, ask)).toEqual({ refusal: { code: "P0001", message: "draft_limit" } });
  });

  it("keeps the drafts from housemates", async () => {
    const house = await makeHouse(["Ava", "Ben"]);
    await db.from("house_drafts").insert({ house_id: house.id, outcome: "ai" });
    for (const actor of house.everyone) {
      const { data } = await actor.db.from("house_drafts").select("id");
      expect(data ?? []).toEqual([]);
    }
    const { error } = await house.admin.db.from("house_drafts").insert({ house_id: house.id, outcome: "ai" });
    expect(error?.code).toBe("42501");
  });
});
