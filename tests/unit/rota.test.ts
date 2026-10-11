import { describe, expect, it } from "vitest";

import { carryOver, fairShares, type RotaJohh, type RotaMember } from "@/lib/rota";

const house = (ids: string[], carry: number[] = []): RotaMember[] =>
  ids.map((userId, i) => ({ userId, carry: carry[i] ?? 0 }));

const JOHHS: RotaJohh[] = [
  { johhId: "bathroom", points: 4, lastUserId: null },
  { johhId: "kitchen", points: 5, lastUserId: null },
  { johhId: "bins", points: 2, lastUserId: null },
  { johhId: "hoover", points: 2, lastUserId: null },
  { johhId: "surfaces", points: 3, lastUserId: null },
  { johhId: "fridge", points: 3, lastUserId: null },
  { johhId: "mop", points: 3, lastUserId: null },
  { johhId: "shop", points: 2, lastUserId: null },
];

function loads(assignments: { johhId: string; userId: string }[], johhs = JOHHS) {
  const pts = new Map(johhs.map((j) => [j.johhId, j.points]));
  const out = new Map<string, number>();
  for (const a of assignments) out.set(a.userId, (out.get(a.userId) ?? 0) + pts.get(a.johhId)!);
  return out;
}

describe("fairShares", () => {
  it("hands out every Johh exactly once", () => {
    const out = fairShares(JOHHS, house(["a", "b", "c", "d"]), "w1");
    expect(out.map((a) => a.johhId).sort()).toEqual(JOHHS.map((j) => j.johhId).sort());
  });

  it("keeps loads within one Johh of each other", () => {
    const out = fairShares(JOHHS, house(["a", "b", "c", "d"]), "w1");
    const l = [...loads(out).values()];
    expect(Math.max(...l) - Math.min(...l)).toBeLessThanOrEqual(5);
    expect(l.reduce((s, v) => s + v, 0)).toBe(24);
  });

  it("is deterministic for the same seed", () => {
    const a = fairShares(JOHHS, house(["a", "b", "c", "d"]), "2026-10-05");
    const b = fairShares(JOHHS, house(["a", "b", "c", "d"]), "2026-10-05");
    expect(a).toEqual(b);
  });

  it("gives the light-loaded person more this week", () => {
    // d did 6 points less than their share lately.
    const out = fairShares(JOHHS, house(["a", "b", "c", "d"], [2, 2, 2, -6]), "w1");
    const l = loads(out);
    expect(l.get("d")!).toBeGreaterThan(l.get("a")!);
  });

  it("moves a Johh on when loads are level", () => {
    const johhs: RotaJohh[] = [{ johhId: "bathroom", points: 4, lastUserId: "a" }];
    const out = fairShares(johhs, house(["a", "b"]), "w1");
    expect(out[0].userId).toBe("b");
  });

  it("still lets fairness beat variety when the gap is real", () => {
    const johhs: RotaJohh[] = [{ johhId: "bathroom", points: 4, lastUserId: "a" }];
    const out = fairShares(johhs, house(["a", "b"], [0, 5]), "w1");
    expect(out[0].userId).toBe("a");
  });

  it("returns nothing for an empty house", () => {
    expect(fairShares(JOHHS, [], "w1")).toEqual([]);
  });

  it("gives one person everything in a house of one", () => {
    const out = fairShares(JOHHS, house(["solo"]), "w1");
    expect(new Set(out.map((a) => a.userId))).toEqual(new Set(["solo"]));
  });

  it("spreads equal Johhs across people rather than stacking one person", () => {
    const four: RotaJohh[] = ["a1", "a2", "a3", "a4"].map((id) => ({
      johhId: id,
      points: 2,
      lastUserId: null,
    }));
    const out = fairShares(four, house(["x", "y", "z", "w"]), "w1");
    expect(new Set(out.map((a) => a.userId)).size).toBe(4);
  });
});

describe("carryOver", () => {
  it("measures each person against their share of each week", () => {
    const out = carryOver(
      [
        {
          memberIds: ["a", "b"],
          assignments: [
            { userId: "a", points: 6 },
            { userId: "b", points: 2 },
          ],
        },
      ],
      ["a", "b"],
    );
    expect(out).toEqual([
      { userId: "a", carry: 2 },
      { userId: "b", carry: -2 },
    ]);
  });

  it("starts a newcomer at zero", () => {
    const out = carryOver(
      [{ memberIds: ["a", "b"], assignments: [{ userId: "a", points: 6 }] }],
      ["a", "b", "new"],
    );
    expect(out.find((m) => m.userId === "new")!.carry).toBe(0);
  });

  it("ignores people who have left", () => {
    const out = carryOver(
      [{ memberIds: ["a", "gone"], assignments: [{ userId: "gone", points: 8 }] }],
      ["a"],
    );
    expect(out).toEqual([{ userId: "a", carry: -4 }]);
  });

  it("feeds back into a fairer next week", () => {
    const history = [
      {
        memberIds: ["a", "b", "c"],
        assignments: [
          { userId: "a", points: 10 },
          { userId: "b", points: 2 },
          { userId: "c", points: 3 },
        ],
      },
    ];
    const members = carryOver(history, ["a", "b", "c"]);
    const out = fairShares(JOHHS, members, "w2");
    const l = loads(out);
    expect(l.get("a")!).toBeLessThan(l.get("b")!);
  });
});
