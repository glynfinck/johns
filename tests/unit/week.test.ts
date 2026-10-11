import { describe, expect, it } from "vitest";

import {
  dueAt,
  graceDue,
  isDueInWeek,
  monthOf,
  monthWindow,
  nextWeek,
  previousMonth,
  weekIndex,
  weekWindow,
} from "@/lib/week";

const LONDON = "Europe/London";

describe("weekWindow", () => {
  it("starts on the house's chosen day at local midnight", () => {
    // Wednesday 8 Oct 2026, 15:00 BST.
    const w = weekWindow(new Date("2026-10-08T14:00:00Z"), LONDON, 1);
    expect(w.startsOn).toBe("2026-10-05");
    expect(w.startsAt.toISOString()).toBe("2026-10-04T23:00:00.000Z");
    expect(w.endsAt.toISOString()).toBe("2026-10-11T23:00:00.000Z");
  });

  it("handles a Sunday start", () => {
    const w = weekWindow(new Date("2026-10-08T14:00:00Z"), LONDON, 7);
    expect(w.startsOn).toBe("2026-10-04");
  });

  it("is 169 hours long across the autumn clock change", () => {
    // Clocks go back on Sunday 25 Oct 2026.
    const w = weekWindow(new Date("2026-10-21T12:00:00Z"), LONDON, 1);
    expect(w.startsOn).toBe("2026-10-19");
    expect((w.endsAt.getTime() - w.startsAt.getTime()) / 3_600_000).toBe(169);
    expect(w.endsAt.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("puts the instant of local midnight in the new week", () => {
    const w = weekWindow(new Date("2026-10-11T23:00:00Z"), LONDON, 1);
    expect(w.startsOn).toBe("2026-10-12");
  });

  it("works in other zones", () => {
    const w = weekWindow(new Date("2026-10-08T14:00:00Z"), "America/Vancouver", 1);
    expect(w.startsOn).toBe("2026-10-05");
    expect(w.startsAt.toISOString()).toBe("2026-10-05T07:00:00.000Z");
  });
});

describe("nextWeek", () => {
  it("follows on exactly", () => {
    const w = weekWindow(new Date("2026-10-21T12:00:00Z"), LONDON, 1);
    const n = nextWeek(w, LONDON, 1);
    expect(n.startsOn).toBe("2026-10-26");
    expect(n.startsAt.getTime()).toBe(w.endsAt.getTime());
  });
});

describe("dueAt", () => {
  const week = weekWindow(new Date("2026-10-08T14:00:00Z"), LONDON, 1);

  it("lands on the right local day and time", () => {
    // Tuesday 19:00 BST.
    expect(dueAt(week, LONDON, 1, 2, "19:00").toISOString()).toBe("2026-10-06T18:00:00.000Z");
    // Sunday 21:30 BST, the week's last day.
    expect(dueAt(week, LONDON, 1, 7, "21:30").toISOString()).toBe("2026-10-11T20:30:00.000Z");
  });

  it("wraps a due day before the start day into the same house week", () => {
    const sundayWeek = weekWindow(new Date("2026-10-08T14:00:00Z"), LONDON, 7);
    // Week runs Sun 4 Oct to Sat 10 Oct; Monday is the 5th.
    expect(dueAt(sundayWeek, LONDON, 7, 1, "09:00").toISOString()).toBe("2026-10-05T08:00:00.000Z");
    const due = dueAt(sundayWeek, LONDON, 7, 6, "23:59");
    expect(due < sundayWeek.endsAt).toBe(true);
  });

  it("keeps local time across the clock change", () => {
    const w = weekWindow(new Date("2026-10-21T12:00:00Z"), LONDON, 1);
    // Monday 19 Oct is BST, Monday's 21:00 is 20:00Z; Sunday 25 Oct is GMT.
    expect(dueAt(w, LONDON, 1, 1, "21:00").toISOString()).toBe("2026-10-19T20:00:00.000Z");
    expect(dueAt(w, LONDON, 1, 7, "21:00").toISOString()).toBe("2026-10-25T21:00:00.000Z");
  });
});

describe("graceDue", () => {
  const ends = new Date("2026-10-11T23:00:00Z");

  it("leaves a Johh due well after the deal alone", () => {
    const due = new Date("2026-10-10T18:00:00Z");
    expect(graceDue(due, new Date("2026-10-08T09:00:00Z"), ends)).toEqual(due);
  });

  it("gives a day's grace to anything due sooner or already past", () => {
    const dealt = new Date("2026-10-08T09:00:00Z");
    expect(graceDue(new Date("2026-10-06T18:00:00Z"), dealt, ends).toISOString()).toBe(
      "2026-10-09T09:00:00.000Z",
    );
  });

  it("never pushes a due time past the week", () => {
    const dealt = new Date("2026-10-11T12:00:00Z");
    expect(graceDue(new Date("2026-10-06T18:00:00Z"), dealt, ends).toISOString()).toBe(
      "2026-10-11T22:59:00.000Z",
    );
  });
});

describe("weekIndex and cadence", () => {
  it("counts consecutive weeks one apart", () => {
    expect(weekIndex("2026-10-12") - weekIndex("2026-10-05")).toBe(1);
    expect(weekIndex("2026-10-11") - weekIndex("2026-10-04")).toBe(1);
  });

  it("repeats fortnightly from the anchor, in both directions", () => {
    const a = weekIndex("2026-10-05");
    expect(isDueInWeek(2, a, a)).toBe(true);
    expect(isDueInWeek(2, a, a + 1)).toBe(false);
    expect(isDueInWeek(2, a, a + 2)).toBe(true);
    expect(isDueInWeek(2, a, a - 2)).toBe(true);
    expect(isDueInWeek(1, a, a + 7)).toBe(true);
    expect(isDueInWeek(4, a, a + 3)).toBe(false);
  });
});

describe("months", () => {
  it("reads the local month", () => {
    // 23:30 UTC on 31 Oct is already 1 Nov? No: GMT by then, still 31 Oct.
    expect(monthOf(new Date("2026-10-31T23:30:00Z"), LONDON)).toBe("2026-10");
    // 23:30 UTC on 30 Sep is 00:30 BST on 1 Oct.
    expect(monthOf(new Date("2026-09-30T23:30:00Z"), LONDON)).toBe("2026-10");
  });

  it("gives local month edges", () => {
    const m = monthWindow("2026-10", LONDON);
    expect(m.startsAt.toISOString()).toBe("2026-09-30T23:00:00.000Z");
    expect(m.endsAt.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("steps back over a year end", () => {
    expect(previousMonth("2027-01")).toBe("2026-12");
    expect(previousMonth("2026-10")).toBe("2026-09");
  });
});
