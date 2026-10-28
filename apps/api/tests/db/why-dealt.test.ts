import { readDealt } from "@app/core";
import { describe, expect, it } from "vitest";

import { addJohns, deal, makeHouse, thisWeek } from "@/tests/support/factories";

/** The deal keeps why each John went where it did, for the John sheet's "Why?". */

describe("why a John was dealt", () => {
  it("keeps who it went to, what decided it, and where each sharer stood", async () => {
    const house = await makeHouse(["Ava", "Ben"]);
    await addJohns(house.id, [{ name: "Bathroom", points: 4 }], thisWeek());
    const { assignments } = await deal(house.id, thisWeek(), thisWeek().startsAt);
    const why = readDealt(assignments[0].dealt);
    expect(why).not.toBeNull();
    expect(why!.to).toBe(assignments[0].user_id);
    // Level, with nothing dealt yet: two shares of 2, so both stand at -2, and the shuffle decides.
    expect(why!.by).toBe("draw");
    expect(new Set(why!.weighed.map((w) => w.userId))).toEqual(new Set(house.everyone.map((x) => x.userId)));
    expect(why!.weighed.every((w) => w.standing === -2)).toBe(true);
    expect(why!.away).toEqual([]);
  });
});
