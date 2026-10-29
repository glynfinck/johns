import { CHAT_TURNS_PER_DAY, CHAT_TURNS_PER_PERSON_PER_DAY, HOUSE_DRAFT_COPY, HouseDraft, starterDraft } from "@app/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { OPTIONS, POST } from "@/app/api/setup/draft/route";
import type { DraftAnswer, DraftContext } from "@/lib/ai/house-draft";
import { chatTurn } from "@/lib/moves/draft";
import { adminClient, signedInUser, type Actor } from "@/tests/support/clients";
import { expectOk } from "@/tests/support/expect";
import { addJohns, makeHouse, thisWeek } from "@/tests/support/factories";

/**
 * POST /api/setup/draft, called as the app calls it, and the chat turn
 * behind it with Claude stood in for. Claude itself is never called here:
 * without the AI Gateway (no Vercel, no AI_GATEWAY_API_KEY) the route offers
 * a starter list, which is also what production does when the gateway is down.
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

async function chatAs(actor: Actor | undefined, body: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json", origin: "http://localhost:8205" };
  if (actor) {
    const { data } = await actor.db.auth.getSession();
    headers.authorization = `Bearer ${data.session!.access_token}`;
  }
  return POST(new Request(BASE, { method: "POST", headers, body: JSON.stringify(body) }));
}

async function turnsIn(houseId: string) {
  const { data } = await db.from("house_drafts").select("outcome, johns, input_tokens, output_tokens, user_id").eq("house_id", houseId);
  return data!;
}

const A_HOUSE = "Me, Ben and Cal in a terrace. Bins go out Tuesday night.";
const said = (text: string) => [{ role: "user" as const, text }];

describe("POST /api/setup/draft", () => {
  it("refuses a caller with no token", async () => {
    const res = await chatAs(undefined, { houseId: crypto.randomUUID(), messages: said(A_HOUSE), draft: null });
    expect(res.status).toBe(401);
  });

  it("asks for something to be said", async () => {
    const house = await makeHouse(["Ava"]);
    const res = await chatAs(house.admin, { houseId: house.id, messages: said("  "), draft: null });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Say something about the house/);
  });

  it("refuses anyone outside the house", async () => {
    const house = await makeHouse(["Ava"]);
    const res = await chatAs(await signedInUser("Zed"), { houseId: house.id, messages: said(A_HOUSE), draft: null });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "That isn’t in your house." });
  });

  it("is for admins only", async () => {
    const house = await makeHouse(["Ava", "Ben"]);
    const res = await chatAs(house.members[0], { houseId: house.id, messages: said(A_HOUSE), draft: null });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Only the house admins can do that." });
  });

  it("offers a starter list that fits when Claude isn't set up, adds nothing and counts nothing", async () => {
    const house = await makeHouse(["Ava"]);
    const res = await chatAs(house.admin, { houseId: house.id, messages: said("Me, my husband and the kids"), draft: null });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: HOUSE_DRAFT_COPY.offline, ask: null, draft: starterDraft("family"), source: "starter" });
    expect(await turnsIn(house.id)).toEqual([]);
    const { count } = await db.from("johns").select("id", { count: "exact", head: true }).eq("house_id", house.id);
    expect(count).toBe(0);
  });

  it("leaves a draft as it is when Claude isn't set up to change it", async () => {
    const house = await makeHouse(["Ava"]);
    const messages = [...said("Flat share"), { role: "assistant", text: HOUSE_DRAFT_COPY.fromStarter }, ...said("Oven every month")];
    const res = await chatAs(house.admin, { houseId: house.id, messages, draft: starterDraft("flat_share") });
    expect(await res.json()).toEqual({ reply: HOUSE_DRAFT_COPY.offlineChange, ask: null, draft: null, source: "starter" });
  });

  it("answers a browser's preflight", async () => {
    const res = OPTIONS(new Request(BASE, { method: "OPTIONS", headers: { origin: "http://localhost:8205" } }));
    expect(res.status).toBe(204);
  });
});

describe("chatTurn, with Claude stood in for", () => {
  const answer: DraftAnswer = {
    raw: {
      reply: "Here’s a first go. Which night do the bins go out?",
      ask: { kind: "day" },
      draft: {
        groups: [{ name: "Upstairs", members: ["me", "Ben", "Priya"] }],
        johns: [
          { name: "Upstairs bathroom", category: "bathroom", points: 4, group: "Upstairs" },
          { name: "Bins out", category: "bins", points: 1, dueDow: 2, dueTime: "21:00" },
        ],
        note: "I guessed the bins go out Tuesday night.",
      },
    },
    inputTokens: 1200,
    outputTokens: 600,
  };

  it("tells Claude who's in the house, the asker first, with the chat and the draft, and tidies what comes back", async () => {
    const house = await makeHouse(["Ava", "Ben"]);
    const current = starterDraft("couple");
    const messages = said(A_HOUSE);
    let told: DraftContext | null = null;
    const result = await chatTurn({ db: house.admin.db, userId: house.admin.userId }, house.id, messages, current, new Date(), async (ctx) => {
      told = ctx;
      return answer;
    });
    expect(told).toMatchObject({ people: [house.admin.name.split(" ")[0], house.members[0].name.split(" ")[0]], weekStarts: 1, messages });
    expect(told!.draft!.johns).toHaveLength(current.johns.length);
    if ("refusal" in result) throw new Error("refused");
    expect(result.source).toBe("ai");
    expect(result.reply).toBe(answer.raw.reply);
    expect(result.ask).toEqual({ kind: "day" });
    expect(HouseDraft.parse(result.draft).johns).toHaveLength(2);
    expect(result.draft!.groups).toEqual([{ name: "Upstairs", memberIds: [house.admin.userId, house.members[0].userId], waitingFor: ["Priya"] }]);
    expect(await turnsIn(house.id)).toEqual([
      { outcome: "ai", johns: 2, input_tokens: 1200, output_tokens: 600, user_id: house.admin.userId },
    ]);
  });

  it("starts a house with a list from that list, and reads Claude's changes back to its Johns", async () => {
    const house = await makeHouse(["Ava"]);
    const [bath, bins] = await addJohns(house.id, [{ name: "Bathroom", points: 3 }, { name: "Bins out", points: 1 }], thisWeek());
    let told: DraftContext | null = null;
    const result = await chatTurn({ db: house.admin.db, userId: house.admin.userId }, house.id, said("Oven every month, and no bins"), null, new Date(), async (ctx) => {
      told = ctx;
      return {
        raw: {
          reply: "Done: an oven clean every four weeks, and the bins are off.",
          ask: { kind: "none" },
          draft: {
            johns: [
              { ref: bath.id.slice(0, 8), name: "Bathroom", category: "other", points: 4 },
              { ref: null, name: "Oven clean", category: "kitchen", points: 5, everyWeeks: 4 },
            ],
            groups: [],
            note: null,
          },
        },
        inputTokens: 10,
        outputTokens: 5,
      };
    });
    expect(told!.editing).toBe(true);
    expect(told!.draft!.johns!.map((j) => j.ref)).toEqual([bath.id.slice(0, 8), bins.id.slice(0, 8)]);
    if ("refusal" in result) throw new Error("refused");
    expect(result.draft!.johns.map((j) => j.id ?? null)).toEqual([bath.id, null]);
    const { data: johns } = await db.from("johns").select("name").eq("house_id", house.id).is("archived_at", null);
    expect(johns).toHaveLength(2);
  });

  it("counts a turn that only talks, and leaves the draft as it is", async () => {
    const house = await makeHouse(["Ava"]);
    const result = await chatTurn({ db: house.admin.db, userId: house.admin.userId }, house.id, said("Is that all?"), starterDraft("couple"), new Date(), async () => ({
      raw: { reply: "That’s the lot for a couple.", ask: { kind: "none" }, draft: null },
      inputTokens: 10,
      outputTokens: 5,
    }));
    expect(result).toEqual({ reply: "That’s the lot for a couple.", ask: null, draft: null, source: "ai" });
    expect((await turnsIn(house.id)).map((d) => d.johns)).toEqual([0]);
  });

  it("offers a starter list when Claude doesn't answer, and counts the try", async () => {
    const house = await makeHouse(["Ava"]);
    const result = await chatTurn({ db: house.admin.db, userId: house.admin.userId }, house.id, said(A_HOUSE), null, new Date(), async () => {
      throw new Error("overloaded");
    });
    expect(result).toEqual({ reply: HOUSE_DRAFT_COPY.offline, ask: null, draft: starterDraft("flat_share"), source: "starter" });
    expect((await turnsIn(house.id)).map((d) => d.outcome)).toEqual(["failed"]);
  });

  it(`stops at ${CHAT_TURNS_PER_DAY} turns a day for a house, counting only the last day`, async () => {
    const house = await makeHouse(["Ava"]);
    const now = new Date();
    const old = new Date(now.getTime() - 25 * 3600_000).toISOString();
    const recent = new Date(now.getTime() - 3600_000).toISOString();
    const { error } = await db.from("house_drafts").insert([
      ...Array.from({ length: CHAT_TURNS_PER_DAY - 1 }, () => ({ house_id: house.id, outcome: "ai", created_at: recent })),
      { house_id: house.id, outcome: "ai", created_at: old },
    ]);
    expect(error).toBeNull();
    const caller = { db: house.admin.db, userId: house.admin.userId };
    const ask = async () => answer;
    expect("reply" in (await chatTurn(caller, house.id, said(A_HOUSE), null, now, ask))).toBe(true);
    expect(await chatTurn(caller, house.id, said(A_HOUSE), null, now, ask)).toEqual({ refusal: { code: "P0001", message: "draft_limit" } });
  });

  it("holds a burst of turns sent together to the day's limit", async () => {
    const house = await makeHouse(["Ava"]);
    const { error } = await db
      .from("house_drafts")
      .insert(Array.from({ length: CHAT_TURNS_PER_DAY - 2 }, () => ({ house_id: house.id, outcome: "ai" })));
    expect(error).toBeNull();
    const caller = { db: house.admin.db, userId: house.admin.userId };
    // Claude takes a moment, as it does: every turn is in flight before any answers.
    const slow = () => new Promise<DraftAnswer>((resolve) => setTimeout(() => resolve(answer), 300));
    const results = await Promise.all(Array.from({ length: 6 }, () => chatTurn(caller, house.id, said(A_HOUSE), null, new Date(), slow)));
    expect(results.filter((r) => "reply" in r)).toHaveLength(2);
    expect(results.filter((r) => "refusal" in r)).toHaveLength(4);
    expect(await turnsIn(house.id)).toHaveLength(CHAT_TURNS_PER_DAY);
  });

  it(`stops a person at ${CHAT_TURNS_PER_PERSON_PER_DAY} turns a day, whichever house they asked from`, async () => {
    const before = await makeHouse(["Ava"]);
    const { error } = await db.from("house_drafts").insert(
      Array.from({ length: CHAT_TURNS_PER_PERSON_PER_DAY }, () => ({ house_id: before.id, user_id: before.admin.userId, outcome: "ai" })),
    );
    expect(error).toBeNull();
    // They leave and start another house: a new house, but the same person's day.
    expectOk(await before.admin.db.rpc("remove_member", { p_house: before.id, p_user: before.admin.userId }));
    const { data: fresh } = await before.admin.db.rpc("create_house", {
      p_name: "Another",
      p_timezone: "Europe/London",
      p_currency: "GBP",
      p_week_starts: 1,
    });
    const caller = { db: before.admin.db, userId: before.admin.userId };
    expect(await chatTurn(caller, fresh!, said(A_HOUSE), null, new Date(), async () => answer)).toEqual({
      refusal: { code: "P0001", message: "draft_limit" },
    });
    expect(await turnsIn(fresh!)).toEqual([]);
  });

  it("keeps the turns from housemates", async () => {
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
