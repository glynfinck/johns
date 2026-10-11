import { describe, expect, it } from "vitest";

import { pointsEarned, standings, weekWinners } from "@/lib/points";
import { earnsImmunity, grantToken, isCleanWeek, streakLength } from "@/lib/streak";

describe("pointsEarned", () => {
  it("pays full for on time, half for late, nothing otherwise", () => {
    expect(pointsEarned("done", 5)).toBe(5);
    expect(pointsEarned("checking", 5)).toBe(5);
    expect(pointsEarned("late", 5)).toBe(2);
    expect(pointsEarned("missed", 5)).toBe(0);
    expect(pointsEarned("excused", 5)).toBe(0);
    expect(pointsEarned("overdue", 5)).toBe(0);
  });
});

describe("standings", () => {
  const table = standings(
    [
      { userId: "priya", points: 5, status: "done" },
      { userId: "priya", points: 2, status: "upcoming" },
      { userId: "sam", points: 3, status: "late" },
      { userId: "sam", points: 4, status: "done" },
      { userId: "tom", points: 3, status: "missed" },
      { userId: "you", points: 2, status: "done" },
      { userId: "you", points: 4, status: "checking" },
    ],
    ["priya", "sam", "tom", "you", "lurker"],
  );

  it("ranks by points earned", () => {
    expect(table.map((r) => [r.userId, r.points, r.rank])).toEqual([
      ["you", 6, 1],
      ["priya", 5, 2],
      ["sam", 5, 2],
      ["lurker", 0, 4],
      ["tom", 0, 4],
    ]);
  });

  it("breaks no ties on points but orders fewer misses first", () => {
    expect(table[3].userId).toBe("lurker");
    expect(table.find((r) => r.userId === "tom")!.missed).toBe(1);
  });

  it("counts done, late and missed", () => {
    const sam = table.find((r) => r.userId === "sam")!;
    expect([sam.done, sam.late, sam.missed]).toEqual([1, 1, 0]);
  });

  it("names every top scorer as a winner", () => {
    expect(weekWinners(table)).toEqual(["you"]);
    const tie = standings(
      [
        { userId: "a", points: 3, status: "done" },
        { userId: "b", points: 3, status: "done" },
      ],
      ["a", "b"],
    );
    expect(weekWinners(tie).sort()).toEqual(["a", "b"]);
    expect(weekWinners(standings([], ["a"]))).toEqual([]);
  });
});

describe("streaks", () => {
  it("knows a clean week", () => {
    expect(isCleanWeek(["done", "excused"])).toBe(true);
    expect(isCleanWeek(["done", "late"])).toBe(false);
    expect(isCleanWeek([])).toBeNull();
  });

  it("counts back from the latest week and skips empty ones", () => {
    expect(streakLength([["missed"], ["done"], [], ["done", "done"]])).toBe(2);
    expect(streakLength([["done"], ["late"]])).toBe(0);
    expect(streakLength([])).toBe(0);
  });

  it("earns immunity every fourth clean week", () => {
    expect(earnsImmunity(3, 4)).toBe(true);
    expect(earnsImmunity(4, 4)).toBe(false);
    expect(earnsImmunity(7, 8)).toBe(true);
    expect(earnsImmunity(4, 5)).toBe(false);
    expect(earnsImmunity(4, 0)).toBe(false);
  });

  it("caps tokens", () => {
    expect(grantToken(0, 2)).toBe(1);
    expect(grantToken(2, 2)).toBe(2);
  });
});
