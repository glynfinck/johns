import { describe, expect, it } from "vitest";

import {
  balanceRows,
  CATCH_UP_PACE,
  canDeal,
  carryOver,
  catchUpWeeks,
  recentBalances,
  fairShares,
  weekShares,
  type DealAssignment,
  type DealJohn,
  type DealMember,
} from "./deal";

const EVERYONE = ["a", "b", "c", "d"];

/** A John the whole house shares, with everyone home. */
const john = (johnId: string, points: number, extra: Partial<DealJohn> = {}): DealJohn => ({
  johnId,
  points,
  lastUserId: null,
  sharers: EVERYONE,
  home: EVERYONE,
  ...extra,
});

const JOHNS: DealJohn[] = [
  john("bathroom", 4),
  john("kitchen", 5),
  john("bins", 2),
  john("hoover", 2),
  john("surfaces", 3),
  john("fridge", 3),
  john("mop", 3),
  john("shop", 2),
];

/** Members with their shares of `johns` and the given balances. */
function members(johns: readonly DealJohn[], ids: string[], balance: number[] = [], makeup = 1): DealMember[] {
  const shares = weekShares(johns, ids, makeup);
  return ids.map((userId, i) => ({ userId, balance: balance[i] ?? 0, share: shares.get(userId)! }));
}

function loads(assignments: DealAssignment[], johns: readonly DealJohn[] = JOHNS) {
  const pts = new Map(johns.map((j) => [j.johnId, j.points]));
  const out = new Map<string, number>();
  for (const a of assignments) out.set(a.userId, (out.get(a.userId) ?? 0) + pts.get(a.johnId)!);
  return out;
}

describe("weekShares", () => {
  it("splits a house-wide John equally", () => {
    const shares = weekShares([john("kitchen", 4)], EVERYONE, 1);
    expect([...shares.values()]).toEqual([1, 1, 1, 1]);
  });

  it("splits a group's John only among the group", () => {
    const upstairs = john("upstairs", 6, { sharers: ["a", "b", "c"], home: ["a", "b", "c"] });
    const downstairs = john("downstairs", 6, { sharers: ["d", "e"], home: ["d", "e"] });
    const shares = weekShares([upstairs, downstairs], ["a", "b", "c", "d", "e"], 1);
    expect(shares.get("a")).toBe(2);
    expect(shares.get("d")).toBe(3);
  });

  it("keeps an away sharer's part when time away is made up in full", () => {
    const shares = weekShares([john("kitchen", 4, { home: ["a", "b", "c"] })], EVERYONE, 1);
    expect(shares.get("d")).toBe(1);
    expect(shares.get("a")).toBe(1);
  });

  it("hands the away part to those home when time away is not made up", () => {
    const shares = weekShares([john("kitchen", 6, { home: ["a", "b", "c"] })], EVERYONE, 0);
    expect(shares.get("d")).toBe(0);
    expect(shares.get("a")).toBe(2);
  });

  it("splits the difference when time away is made up by half", () => {
    const shares = weekShares([john("kitchen", 8, { home: ["a", "b", "c"] })], EVERYONE, 0.5);
    expect(shares.get("d")).toBe(1);
    expect(shares.get("a")).toBeCloseTo(7 / 3);
  });

  it("always adds up to the points that are dealt", () => {
    const johns = [john("kitchen", 5, { home: ["a"] }), john("bins", 3, { home: ["b", "c"] }), john("shop", 2)];
    for (const makeup of [0, 0.5, 1]) {
      const total = [...weekShares(johns, EVERYONE, makeup).values()].reduce((s, v) => s + v, 0);
      expect(total).toBeCloseTo(10);
    }
  });

  it("skips a John nobody who shares it is home for", () => {
    const empty = john("downstairs", 6, { sharers: ["d"], home: [] });
    expect(canDeal(empty)).toBe(false);
    expect(weekShares([empty], EVERYONE, 1).get("d")).toBe(0);
  });
});

describe("fairShares", () => {
  it("hands out every John exactly once", () => {
    const out = fairShares(JOHNS, members(JOHNS, EVERYONE), "w1");
    expect(out.map((a) => a.johnId).sort()).toEqual(JOHNS.map((j) => j.johnId).sort());
  });

  it("keeps loads within one John of each other", () => {
    const out = fairShares(JOHNS, members(JOHNS, EVERYONE), "w1");
    const l = [...loads(out).values()];
    expect(Math.max(...l) - Math.min(...l)).toBeLessThanOrEqual(5);
    expect(l.reduce((s, v) => s + v, 0)).toBe(24);
  });

  it("is deterministic for the same seed", () => {
    const a = fairShares(JOHNS, members(JOHNS, EVERYONE), "2026-10-05");
    const b = fairShares(JOHNS, members(JOHNS, EVERYONE), "2026-10-05");
    expect(a).toEqual(b);
  });

  it("gives someone behind more this week", () => {
    const out = fairShares(JOHNS, members(JOHNS, EVERYONE, [2, 2, 2, -6]), "w1");
    const l = loads(out);
    expect(l.get("d")!).toBeGreaterThan(l.get("a")!);
  });

  it("moves a John on when balances are level", () => {
    const johns = [john("bathroom", 4, { lastUserId: "a", sharers: ["a", "b"], home: ["a", "b"] })];
    const out = fairShares(johns, members(johns, ["a", "b"]), "w1");
    expect(out[0].userId).toBe("b");
  });

  it("still lets fairness beat variety when the gap is real", () => {
    const johns = [john("bathroom", 4, { lastUserId: "a", sharers: ["a", "b"], home: ["a", "b"] })];
    const out = fairShares(johns, members(johns, ["a", "b"], [0, 5]), "w1");
    expect(out[0].userId).toBe("a");
  });

  it("returns nothing for an empty house", () => {
    expect(fairShares(JOHNS, [], "w1")).toEqual([]);
  });

  it("gives one person everything in a house of one", () => {
    const solo = JOHNS.map((j) => ({ ...j, sharers: ["solo"], home: ["solo"] }));
    const out = fairShares(solo, members(solo, ["solo"]), "w1");
    expect(out).toHaveLength(solo.length);
    expect(new Set(out.map((a) => a.userId))).toEqual(new Set(["solo"]));
  });

  it("spreads equal Johns across people rather than stacking one person", () => {
    const four = ["a1", "a2", "a3", "a4"].map((id) => john(id, 2));
    const out = fairShares(four, members(four, EVERYONE), "w1");
    expect(new Set(out.map((a) => a.userId)).size).toBe(4);
  });

  it("only hands a group's John to the group", () => {
    const upstairs = ["u1", "u2", "u3"].map((id) => john(id, 3, { sharers: ["a", "b", "c"], home: ["a", "b", "c"] }));
    const downstairs = ["d1", "d2"].map((id) => john(id, 3, { sharers: ["d", "e"], home: ["d", "e"] }));
    const johns = [...upstairs, ...downstairs];
    const out = fairShares(johns, members(johns, ["a", "b", "c", "d", "e"]), "w1");
    for (const a of out) {
      const j = johns.find((x) => x.johnId === a.johnId)!;
      expect(j.sharers).toContain(a.userId);
    }
    expect(new Set(out.filter((a) => a.johnId.startsWith("d")).map((a) => a.userId))).toEqual(new Set(["d", "e"]));
  });

  it("never hands someone a John due on a day they are away", () => {
    const johns = JOHNS.map((j) => ({ ...j, home: ["a", "b", "c"] }));
    const out = fairShares(johns, members(johns, EVERYONE), "w1");
    expect(out.some((a) => a.userId === "d")).toBe(false);
    expect(out).toHaveLength(johns.length);
  });

  it("leaves out a John nobody is home for", () => {
    const johns = [john("kitchen", 4), john("downstairs", 6, { sharers: ["d"], home: [] })];
    const out = fairShares(johns, members(johns, EVERYONE), "w1");
    expect(out.map((a) => a.johnId)).toEqual(["kitchen"]);
  });

  it("catches someone up gradually after time away, never all at once", () => {
    // d is back owing two weeks of their share; this week's share is 6 each.
    const out = fairShares(JOHNS, members(JOHNS, EVERYONE, [4, 4, 4, -12]), "w1");
    const l = loads(out);
    const share = 24 / 4;
    expect(l.get("d")!).toBeGreaterThan(share);
    expect(l.get("d")!).toBeLessThanOrEqual(share * (1 + CATCH_UP_PACE));
  });

  it("does not let rounding in a share refuse someone catching up", () => {
    // Six two-point Johns split three ways: each share is six thirds of a
    // point, which is 3.9999… in floating point, not 4.
    const ids = ["a", "b", "c"];
    const six = ["s1", "s2", "s3", "s4", "s5", "s6"].map((id) => john(id, 2, { sharers: ids, home: ids }));
    const out = fairShares(six, members(six, ids, [2, 2, -4]), "w1");
    expect(loads(out, six).get("c")).toBe(6);
  });
});

describe("carryOver", () => {
  it("measures each person against their share of each week", () => {
    const out = carryOver(
      [
        {
          shares: [
            { userId: "a", share: 4 },
            { userId: "b", share: 4 },
          ],
          assignments: [
            { userId: "a", points: 6 },
            { userId: "b", points: 2 },
          ],
        },
      ],
      ["a", "b"],
    );
    expect(Object.fromEntries(out)).toEqual({ a: 2, b: -2 });
  });

  it("starts a newcomer at zero", () => {
    const out = carryOver(
      [{ shares: [{ userId: "a", share: 3 }], assignments: [{ userId: "a", points: 6 }] }],
      ["a", "new"],
    );
    expect(out.get("new")).toBe(0);
  });

  it("ignores people who have left", () => {
    const out = carryOver(
      [
        {
          shares: [
            { userId: "a", share: 4 },
            { userId: "gone", share: 4 },
          ],
          assignments: [{ userId: "gone", points: 8 }],
        },
      ],
      ["a"],
    );
    expect(Object.fromEntries(out)).toEqual({ a: -4 });
  });

  it("puts someone who was away behind by the share they kept", () => {
    // A week away, made up in full: d was handed nothing but still had a share.
    const week = JOHNS.map((j) => ({ ...j, home: ["a", "b", "c"] }));
    const shares = weekShares(week, EVERYONE, 1);
    const handed = loads(fairShares(week, members(week, EVERYONE), "w0"), week);
    const out = carryOver(
      [
        {
          shares: [...shares].map(([userId, share]) => ({ userId, share })),
          assignments: [...handed].map(([userId, points]) => ({ userId, points })),
        },
      ],
      EVERYONE,
    );
    expect(out.get("d")).toBe(-6);
    expect([...out.values()].reduce((s, v) => s + v, 0)).toBeCloseTo(0);
  });

  it("feeds back into a fairer next week", () => {
    const history = [
      {
        shares: ["a", "b", "c"].map((userId) => ({ userId, share: 5 })),
        assignments: [
          { userId: "a", points: 10 },
          { userId: "b", points: 2 },
          { userId: "c", points: 3 },
        ],
      },
    ];
    const balance = carryOver(history, ["a", "b", "c"]);
    const johns = JOHNS.map((j) => ({ ...j, sharers: ["a", "b", "c"], home: ["a", "b", "c"] }));
    const ms = members(johns, ["a", "b", "c"], ["a", "b", "c"].map((id) => balance.get(id)!));
    const l = loads(fairShares(johns, ms, "w2"), johns);
    expect(l.get("a")!).toBeLessThan(l.get("b")!);
  });
});

describe("catchUpWeeks", () => {
  it("is zero for anyone level or ahead", () => {
    expect(catchUpWeeks(0, 6)).toBe(0);
    expect(catchUpWeeks(3, 6)).toBe(0);
  });

  it("counts the weeks at half a share extra each", () => {
    expect(catchUpWeeks(-12, 6)).toBe(4);
    expect(catchUpWeeks(-1, 6)).toBe(1);
  });
});

describe("recentBalances", () => {
  const rows = {
    weekIds: ["w2", "w1"],
    shares: [
      { week_id: "w1", user_id: "ava", share: 4 },
      { week_id: "w1", user_id: "ben", share: 4 },
      { week_id: "w2", user_id: "ava", share: "3" },
      { week_id: "w2", user_id: "ben", share: 3 },
      { week_id: "w0", user_id: "ava", share: 100 },
    ],
    handed: [
      { week_id: "w1", user_id: "ava", points: 2 },
      { week_id: "w1", user_id: "ben", points: 6 },
      { week_id: "w2", user_id: "ava", points: 3 },
      { week_id: "w2", user_id: "ben", points: 3 },
      { week_id: "w0", user_id: "ben", points: 100 },
    ],
  };

  it("balances what each was handed against their share, over the weeks asked for", () => {
    const { balances } = recentBalances(rows, ["ava", "ben"]);
    expect(balances).toEqual(new Map([["ava", -2], ["ben", 2]]));
  });

  it("takes a usual week's share as the average of the weeks they had one", () => {
    const { usualShare } = recentBalances(rows, ["ava", "ben", "cal"]);
    expect(usualShare.get("ben")).toBe(3.5);
    // Ava's 100 is from a week outside the ones asked for, but it is still one of her shares.
    expect(usualShare.get("ava")).toBeCloseTo(107 / 3);
    expect(usualShare.get("cal")).toBe(0);
  });

  it("is level for everyone with no weeks behind them", () => {
    const { balances, usualShare } = recentBalances({ weekIds: [], shares: [], handed: [] }, ["ava"]);
    expect(balances).toEqual(new Map([["ava", 0]]));
    expect(usualShare).toEqual(new Map([["ava", 0]]));
  });
});

describe("balanceRows", () => {
  it("puts whoever is furthest behind first, with how long catching up takes", () => {
    const rows = balanceRows(
      new Map([["ava", -6], ["ben", 4], ["cal", 2]]),
      new Map([["ava", 4], ["ben", 4], ["cal", 0]]),
      ["ben", "ava", "cal"],
    );
    expect(rows).toEqual([
      { userId: "ava", balance: -6, weeksToEven: catchUpWeeks(-6, 4) },
      { userId: "cal", balance: 2, weeksToEven: 0 },
      { userId: "ben", balance: 4, weeksToEven: 0 },
    ]);
  });

  it("counts someone with no balance yet as level", () => {
    expect(balanceRows(new Map(), new Map(), ["ava"])).toEqual([{ userId: "ava", balance: 0, weeksToEven: 0 }]);
    expect(balanceRows(new Map(), new Map(), [])).toEqual([]);
  });
});
