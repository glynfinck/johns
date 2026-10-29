import { describe, expect, it } from "vitest";

import {
  BALANCE_WEEKS,
  CATCH_UP_PACE,
  carryOver,
  fairShares,
  weekShares,
  type DealJohn,
  type PastJohn,
  type PastWeek,
} from "./deal";
import { balances, settleMonth, settleUp, type LedgerEntry } from "./stake";

/**
 * Fair shares over months and years. deal.test.ts pins one week at a time;
 * these run the deal the way the engine does, week after week: each week's
 * shares (weekShares), balances from the last BALANCE_WEEKS weeks
 * (carryOver), the deal (fairShares), then how each John ended, fed back into
 * the next week. Then they ask whether, over a year or five, everybody did
 * their share, whatever the house threw at the deal: time away, misses,
 * covering, people coming and going.
 */

interface HouseJohn {
  johnId: string;
  points: number;
  /** Who shares it; the whole house when left out. */
  group?: readonly string[];
}

interface Sim {
  weeks: number;
  johns: readonly HouseJohn[];
  /** Who lives there in week `w` (from 0), in join order. */
  members: (w: number) => readonly string[];
  /** Whether `userId` is away on the day `johnId` is due in week `w`. */
  away?: (w: number, userId: string, johnId: string) => boolean;
  /** How a John handed to `userId` ended. Done unless it says otherwise. */
  ends?: (w: number, userId: string, johnId: string) => Pick<PastJohn, "outcome" | "coveredBy">;
  /** houses.away_makeup as a fraction: 1 in full, 0.5 half, 0 none. */
  makeup?: number;
  seed?: string;
}

interface Tally {
  /** Everything they were owed, over every week they lived there. */
  share: number;
  /** Everything that counts as their work (creditedTo). */
  credited: number;
  /** Everything they were handed, done or not. */
  handed: number;
}

interface Run {
  tally: Map<string, Tally>;
  /** Each week: per person, credited minus share so far (a lifetime balance). */
  lifetime: Map<string, number>[];
  /** Each week: per person, the points handed that week and their share of it. */
  weekly: Map<string, { handed: number; share: number }>[];
  /** How many times each person did each John. */
  did: Map<string, Map<string, number>>;
}

function simulate(sim: Sim): Run {
  const history: PastWeek[] = [];
  const last = new Map<string, string>();
  const tally = new Map<string, Tally>();
  const did = new Map<string, Map<string, number>>();
  const lifetime: Run["lifetime"] = [];
  const weekly: Run["weekly"] = [];
  const makeup = sim.makeup ?? 1;

  for (let w = 0; w < sim.weeks; w++) {
    const ids = sim.members(w);
    for (const id of ids) if (!tally.has(id)) tally.set(id, { share: 0, credited: 0, handed: 0 });

    const johns: DealJohn[] = sim.johns.map((j) => {
      const sharers = (j.group ?? ids).filter((id) => ids.includes(id));
      return {
        johnId: j.johnId,
        points: j.points,
        lastUserId: last.get(j.johnId) ?? null,
        sharers,
        home: sharers.filter((id) => !sim.away?.(w, id, j.johnId)),
      };
    });
    const shares = weekShares(johns, ids, makeup);
    const balance = carryOver(history.slice(-BALANCE_WEEKS), ids);
    const dealt = fairShares(
      johns,
      ids.map((userId) => ({ userId, balance: balance.get(userId)!, share: shares.get(userId)! })),
      `${sim.seed ?? "sim"}:${w}`,
    );

    const points = new Map(johns.map((j) => [j.johnId, j.points]));
    const thisWeek = new Map(ids.map((id) => [id, { handed: 0, share: shares.get(id)! }]));
    const assignments: PastJohn[] = dealt.map(({ johnId, userId }) => {
      last.set(johnId, userId);
      thisWeek.get(userId)!.handed += points.get(johnId)!;
      return { userId, points: points.get(johnId)!, ...(sim.ends?.(w, userId, johnId) ?? { outcome: "done" }) };
    });
    history.push({ shares: ids.map((userId) => ({ userId, share: shares.get(userId)! })), assignments });

    for (const id of ids) tally.get(id)!.share += shares.get(id)!;
    for (const a of assignments) {
      tally.get(a.userId)!.handed += a.points;
      const who = a.coveredBy ?? (a.outcome === "missed" ? null : a.userId);
      if (who) tally.get(who)!.credited += a.points;
    }
    for (const { johnId, userId } of dealt) {
      const mine = did.get(userId) ?? new Map<string, number>();
      mine.set(johnId, (mine.get(johnId) ?? 0) + 1);
      did.set(userId, mine);
    }
    lifetime.push(new Map(ids.map((id) => [id, tally.get(id)!.credited - tally.get(id)!.share])));
    weekly.push(thisWeek);
  }
  return { tally, lifetime, weekly, did };
}

/** The furthest anyone's lifetime balance strayed from level, over the weeks given. */
function worstDrift(run: Run, from = 0, to = run.lifetime.length, who?: readonly string[]): number {
  let worst = 0;
  for (const week of run.lifetime.slice(from, to)) {
    for (const [id, v] of week) if (!who || who.includes(id)) worst = Math.max(worst, Math.abs(v));
  }
  return worst;
}

const A_YEAR = 52;
const FIVE_YEARS = 5 * A_YEAR;
const FOUR = ["a", "b", "c", "d"] as const;
const always = (ids: readonly string[]) => () => ids;

/** A real week's list: uneven points, from a 2-point bins to a 5-point kitchen. */
const HOUSE: HouseJohn[] = [
  { johnId: "kitchen", points: 5 },
  { johnId: "bathroom", points: 4 },
  { johnId: "surfaces", points: 3 },
  { johnId: "fridge", points: 3 },
  { johnId: "mop", points: 3 },
  { johnId: "bins", points: 2 },
  { johnId: "hoover", points: 2 },
  { johnId: "shop", points: 2 },
];
const BIGGEST = 5;

describe("over years, with everyone home and everything done", () => {
  it("keeps everyone within one John of their share, week after week for five years", () => {
    const run = simulate({ weeks: FIVE_YEARS, johns: HOUSE, members: always(FOUR) });
    expect(worstDrift(run)).toBeLessThanOrEqual(BIGGEST);
    // And at the end, level to within a John's worth either way.
    for (const id of FOUR)
      expect(Math.abs(run.tally.get(id)!.credited - run.tally.get(id)!.share)).toBeLessThanOrEqual(BIGGEST);
  });

  it("does not drift with more years: year five is no further out than year one", () => {
    const run = simulate({ weeks: FIVE_YEARS, johns: HOUSE, members: always(FOUR) });
    expect(worstDrift(run, 4 * A_YEAR)).toBeLessThanOrEqual(Math.max(worstDrift(run, 0, A_YEAR), 1));
  });

  it("holds for any house size from two to six, and any seed", () => {
    for (const size of [2, 3, 4, 5, 6]) {
      const ids = ["a", "b", "c", "d", "e", "f"].slice(0, size);
      for (const seed of ["one", "two", "three"]) {
        const run = simulate({ weeks: A_YEAR * 2, johns: HOUSE, members: always(ids), seed });
        expect(worstDrift(run), `${size} people, seed ${seed}`).toBeLessThanOrEqual(BIGGEST);
      }
    }
  });

  it("moves every John round: over a year, each person does each one", () => {
    const run = simulate({ weeks: A_YEAR, johns: HOUSE, members: always(FOUR) });
    for (const id of FOUR) {
      for (const j of HOUSE) expect(run.did.get(id)?.get(j.johnId) ?? 0, `${id} on ${j.johnId}`).toBeGreaterThan(0);
    }
  });

  it("shares the worst John: nobody does the kitchen more than twice as often as anyone else", () => {
    const run = simulate({ weeks: A_YEAR, johns: HOUSE, members: always(FOUR) });
    const kitchens = FOUR.map((id) => run.did.get(id)?.get("kitchen") ?? 0);
    expect(Math.max(...kitchens)).toBeLessThanOrEqual(2 * Math.min(...kitchens));
  });

  it("evens out Johns that can't split evenly: three people, four equal Johns", () => {
    const johns = ["w", "x", "y", "z"].map((johnId) => ({ johnId, points: 3 }));
    const run = simulate({ weeks: A_YEAR, johns, members: always(["a", "b", "c"]) });
    const handed = ["a", "b", "c"].map((id) => run.tally.get(id)!.handed);
    expect(Math.max(...handed) - Math.min(...handed)).toBeLessThanOrEqual(3);
  });
});

describe("over years, with groups", () => {
  // Upstairs a, b and c share a bathroom; d has the downstairs one alone.
  const johns: HouseJohn[] = [
    ...HOUSE.filter((j) => j.johnId !== "bathroom"),
    { johnId: "upstairs", points: 4, group: ["a", "b", "c"] },
    { johnId: "downstairs", points: 3, group: ["d"] },
  ];

  it("keeps everyone level against what they share, not what the house does", () => {
    const run = simulate({ weeks: FIVE_YEARS, johns, members: always(FOUR) });
    expect(worstDrift(run)).toBeLessThanOrEqual(BIGGEST);
  });

  it("never hands a group's John outside the group", () => {
    const run = simulate({ weeks: A_YEAR, johns, members: always(FOUR) });
    expect(run.did.get("d")?.get("upstairs") ?? 0).toBe(0);
    for (const id of ["a", "b", "c"]) expect(run.did.get(id)?.get("downstairs") ?? 0).toBe(0);
  });
});

describe("time away, over the months after", () => {
  /** b away for `length` weeks from week 10. */
  const awayFor = (length: number) => (w: number, id: string) => id === "b" && w >= 10 && w < 10 + length;

  // Known issue. b pays the month back by week 21, but at week 22 the away
  // weeks fall out of the 12-week window while the weeks b caught up in are
  // still in it, so b looks ahead and is dealt next to nothing for a month.
  // That echo comes back every 12 weeks and never dies: over five years b
  // sits 10 to 15 points behind on average, and up to 24. Remove `.fails`
  // once balances stop forgetting debts that aren't paid yet.
  it.fails("pays back a month away in full, then stays level", () => {
    const run = simulate({ weeks: A_YEAR, johns: HOUSE, members: always(FOUR), away: awayFor(4) });
    // Behind by about a month's share on the way back...
    expect(run.lifetime[13].get("b")!).toBeLessThan(-3 * BIGGEST);
    // ...and level again within a few months, for good.
    expect(worstDrift(run, 30)).toBeLessThanOrEqual(BIGGEST);
  });

  it("catches up gradually: never more than half a share extra in a week while others can take it", () => {
    const run = simulate({ weeks: A_YEAR, johns: HOUSE, members: always(FOUR), away: awayFor(4) });
    for (const week of run.weekly.slice(14)) {
      const b = week.get("b")!;
      expect(b.handed).toBeLessThanOrEqual(b.share * (1 + CATCH_UP_PACE) + 1e-9);
    }
  });

  it("asks nothing back when the house doesn't make up time away", () => {
    const run = simulate({ weeks: A_YEAR, johns: HOUSE, members: always(FOUR), away: awayFor(4), makeup: 0 });
    expect(worstDrift(run)).toBeLessThanOrEqual(BIGGEST);
  });

  it("asks half back when the house makes up half", () => {
    const full = simulate({ weeks: 15, johns: HOUSE, members: always(FOUR), away: awayFor(4) });
    const half = simulate({ weeks: 15, johns: HOUSE, members: always(FOUR), away: awayFor(4), makeup: 0.5 });
    const owedFull = full.lifetime[13].get("b")!;
    const owedHalf = half.lifetime[13].get("b")!;
    expect(owedHalf).toBeCloseTo(owedFull / 2, 0);
  });

  it("everyone takes a fortnight away in turn through the year, and ends the year level", () => {
    const away = (w: number, id: string) => {
      const start = 4 + 12 * FOUR.indexOf(id as (typeof FOUR)[number]);
      return w >= start && w < start + 2;
    };
    const run = simulate({ weeks: A_YEAR, johns: HOUSE, members: always(FOUR), away });
    for (const id of FOUR) expect(Math.abs(run.lifetime[A_YEAR - 1].get(id)!), id).toBeLessThanOrEqual(BIGGEST);
  });
});

describe("misses and covers, over months", () => {
  it("brings a missed John back to whoever missed it, not to the rest of the house", () => {
    // b misses every bins they get.
    const run = simulate({
      weeks: A_YEAR,
      johns: HOUSE,
      members: always(FOUR),
      ends: (_w, id, johnId) => ({ outcome: id === "b" && johnId === "bins" ? "missed" : "done" }),
    });
    // The others never carry b's misses: each is handed no more than their share, give or take a John.
    for (const id of ["a", "c", "d"]) {
      const t = run.tally.get(id)!;
      expect(t.handed - t.share, id).toBeLessThanOrEqual(BIGGEST);
    }
    // And b is handed more than a share, to make up what they missed.
    expect(run.tally.get("b")!.handed).toBeGreaterThan(run.tally.get("b")!.share);
  });

  it("deals a coverer less in the weeks after", () => {
    // c covers whatever b is handed in week 4.
    const run = simulate({
      weeks: 12,
      johns: HOUSE,
      members: always(FOUR),
      ends: (w, id) => (id === "b" && w === 4 ? { outcome: "covered", coveredBy: "c" } : { outcome: "done" }),
    });
    const after = run.weekly.slice(5).reduce((sum, week) => sum + week.get("c")!.handed - week.get("c")!.share, 0);
    expect(after).toBeLessThan(0);
  });

  // Known issue. Covering once a month, c ends year one 6 points ahead of
  // their share, year three 24, year five 40, while b falls 48 behind: the
  // deal starts paying c back, but the 12-week window forgets each cover
  // before it is paid off. Remove `.fails` once covers are paid back in full.
  it.fails("never leaves a regular coverer doing more than their share, however many years", () => {
    // c covers whatever b is handed in the first week of each month.
    const run = simulate({
      weeks: FIVE_YEARS,
      johns: HOUSE,
      members: always(FOUR),
      ends: (w, id) => (id === "b" && w % 4 === 0 ? { outcome: "covered", coveredBy: "c" } : { outcome: "done" }),
    });
    expect(worstDrift(run, 0, FIVE_YEARS, ["c"])).toBeLessThanOrEqual(2 * BIGGEST);
  });
});

describe("people coming and going", () => {
  it("starts a newcomer level, and keeps the rest level as the house grows", () => {
    const run = simulate({
      weeks: A_YEAR,
      johns: HOUSE,
      members: (w) => (w < 20 ? ["a", "b", "c"] : FOUR),
    });
    expect(worstDrift(run)).toBeLessThanOrEqual(BIGGEST);
  });

  it("keeps the rest level when someone leaves", () => {
    const run = simulate({
      weeks: A_YEAR,
      johns: HOUSE,
      members: (w) => (w < 20 ? FOUR : ["a", "b", "c"]),
    });
    expect(worstDrift(run, 0, A_YEAR, ["a", "b", "c"])).toBeLessThanOrEqual(BIGGEST);
  });
});

describe("the Stake, over a year of months", () => {
  /** Twelve month closes; `forfeits(m)` is that month's forfeits. Every entry, in the order written. */
  function aYear(ids: readonly string[], forfeits: (m: number) => { userId: string; amount: number }[]): LedgerEntry[] {
    const entries: LedgerEntry[] = [];
    for (let m = 0; m < 12; m++) {
      const month = forfeits(m);
      for (const f of month) entries.push({ userId: f.userId, kind: "forfeit", amount: -f.amount });
      entries.push(...settleMonth(ids, 2000, month).entries);
    }
    return entries;
  }

  it("never makes or loses money: a year of entries sums to zero", () => {
    const entries = aYear(FOUR, (m) => [
      { userId: FOUR[m % 4], amount: 500 },
      { userId: FOUR[(m + 1) % 4], amount: 150 },
    ]);
    expect([...balances(entries).values()].reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("settles up a year in fewer transfers than people, and leaves everyone square", () => {
    const entries = aYear(FOUR, (m) => [{ userId: FOUR[m % 3], amount: 300 + 50 * m }]);
    const owed = balances(entries);
    const transfers = settleUp(owed);
    expect(transfers.length).toBeLessThan(FOUR.length);
    for (const t of transfers) {
      owed.set(t.from, owed.get(t.from)! + t.amount);
      owed.set(t.to, owed.get(t.to)! - t.amount);
    }
    for (const v of owed.values()) expect(v).toBe(0);
  });

  it("caps a month at the stake, however bad, and starts the next month fresh", () => {
    const entries = aYear(FOUR, () => [
      { userId: "a", amount: 1500 },
      { userId: "a", amount: 1500 },
    ]);
    expect(balances(entries).get("a")).toBe(-2000 * 12);
  });

  // Known issue. When a forfeit doesn't split evenly, settleMonth gives the
  // odd penny to the first in join order, every month. Four people missing
  // one 500 John each a month: a and b end the year 12p up, d 24p down.
  // Remove `.fails` once the odd penny takes turns.
  it.fails("treats everyone the same when everyone does the same: a year of equal misses comes out even", () => {
    // Everyone misses one 500 John a month. Nobody should be up or down.
    const entries = aYear(FOUR, () => FOUR.map((userId) => ({ userId, amount: 500 })));
    const owed = balances(entries);
    for (const id of FOUR) expect(owed.get(id) ?? 0, id).toBe(0);
  });
});
