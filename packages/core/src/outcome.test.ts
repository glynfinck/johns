import { describe, expect, it } from "vitest";

import { flagClosesAt, liveStatus, settleOutcome, standsAt, tickWouldBe, type AssignmentFacts } from "./outcome";

const due = new Date("2026-10-08T18:00:00Z");
const weekEnds = new Date("2026-10-11T23:00:00Z");
const base: AssignmentFacts = {
  dueAt: due,
  doneAt: null,
  excused: false,
  disputeOpen: false,
  weekEndsAt: weekEnds,
};
const at = (iso: string) => new Date(iso);

describe("settleOutcome", () => {
  it("waits while a tick is inside the dispute window", () => {
    const a = { ...base, doneAt: at("2026-10-08T12:00:00Z") };
    expect(settleOutcome(a, at("2026-10-09T11:59:00Z"), 24)).toBeNull();
    expect(settleOutcome(a, at("2026-10-09T12:00:00Z"), 24)).toBe("done");
  });

  it("calls a tick after the due time late", () => {
    const a = { ...base, doneAt: at("2026-10-09T09:00:00Z") };
    expect(settleOutcome(a, at("2026-10-10T09:00:00Z"), 24)).toBe("late");
  });

  it("counts a tick exactly on the due time as on time", () => {
    const a = { ...base, doneAt: due };
    expect(settleOutcome(a, at("2026-10-10T00:00:00Z"), 24)).toBe("done");
  });

  it("holds while a dispute is open, however long", () => {
    const a = { ...base, doneAt: at("2026-10-08T12:00:00Z"), disputeOpen: true };
    expect(settleOutcome(a, at("2026-10-20T00:00:00Z"), 24)).toBeNull();
  });

  it("misses a John the week closed on", () => {
    expect(settleOutcome(base, at("2026-10-11T22:59:59Z"), 24)).toBeNull();
    expect(settleOutcome(base, weekEnds, 24)).toBe("missed");
  });

  it("lets a late-night tick stand after the week ends", () => {
    const a = { ...base, doneAt: at("2026-10-11T22:00:00Z") };
    expect(settleOutcome(a, at("2026-10-12T08:00:00Z"), 24)).toBeNull();
    expect(settleOutcome(a, at("2026-10-12T22:00:00Z"), 24)).toBe("late");
  });

  it("excuses whatever else is true", () => {
    expect(settleOutcome({ ...base, excused: true }, at("2026-10-01T00:00:00Z"), 24)).toBe("excused");
  });

  it("settles instantly with no dispute window", () => {
    const a = { ...base, doneAt: at("2026-10-08T12:00:00Z") };
    expect(settleOutcome(a, at("2026-10-08T12:00:00Z"), 0)).toBe("done");
  });
});

describe("liveStatus", () => {
  const live = (over: Partial<AssignmentFacts>, now: string) =>
    liveStatus({ ...base, ...over, outcome: null }, at(now), 24);

  it("reads the open states", () => {
    expect(live({}, "2026-10-06T12:00:00Z")).toBe("upcoming");
    expect(live({}, "2026-10-07T19:00:00Z")).toBe("due-soon");
    expect(live({}, "2026-10-08T18:00:01Z")).toBe("overdue");
  });

  it("reads the ticked states", () => {
    expect(live({ doneAt: at("2026-10-08T12:00:00Z") }, "2026-10-08T13:00:00Z")).toBe("checking");
    expect(
      live({ doneAt: at("2026-10-08T12:00:00Z"), disputeOpen: true }, "2026-10-08T13:00:00Z"),
    ).toBe("disputed");
  });

  it("prefers a stamped outcome", () => {
    expect(liveStatus({ ...base, outcome: "late" }, at("2026-10-06T00:00:00Z"), 24)).toBe("late");
  });
});

describe("helpers", () => {
  it("stands a day after the tick", () => {
    expect(standsAt(at("2026-10-08T12:00:00Z"), 24).toISOString()).toBe("2026-10-09T12:00:00.000Z");
  });

  it("says what a tick now would be", () => {
    expect(tickWouldBe(due, at("2026-10-08T17:00:00Z"), weekEnds)).toBe("on-time");
    expect(tickWouldBe(due, at("2026-10-09T17:00:00Z"), weekEnds)).toBe("late");
    expect(tickWouldBe(due, weekEnds, weekEnds)).toBe("closed");
  });
});

describe("flags (on-call Johns)", () => {
  // Raised Thursday 8pm with 12 hours: due Friday 8am, missed Friday 8pm.
  const flaggedAt = at("2026-10-08T20:00:00Z");
  const flag: AssignmentFacts = { ...base, flaggedAt, dueAt: at("2026-10-09T08:00:00Z") };

  it("closes a John due on a day when its week ends", () => {
    expect(flagClosesAt(base)).toEqual(weekEnds);
    expect(flagClosesAt({ ...base, flaggedAt: null })).toEqual(weekEnds);
  });

  it("misses a flag at twice its window", () => {
    expect(flagClosesAt(flag).toISOString()).toBe("2026-10-09T20:00:00.000Z");
    expect(settleOutcome(flag, at("2026-10-09T19:59:00Z"), 24)).toBeNull();
    expect(settleOutcome(flag, at("2026-10-09T20:00:00Z"), 24)).toBe("missed");
  });

  it("misses an overdue flag when its week ends first", () => {
    // Raised Sunday 4am, due 4pm; the week ends 11pm, before 4am Monday.
    const late = { ...base, flaggedAt: at("2026-10-11T04:00:00Z"), dueAt: at("2026-10-11T16:00:00Z") };
    expect(flagClosesAt(late)).toEqual(weekEnds);
  });

  it("keeps a flag open past its week's end while it is still in time", () => {
    // Raised Sunday 8pm: due 8am Monday, in the next week, and still the same person's.
    const straddling = { ...base, flaggedAt: at("2026-10-11T20:00:00Z"), dueAt: at("2026-10-12T08:00:00Z") };
    expect(flagClosesAt(straddling).toISOString()).toBe("2026-10-12T20:00:00.000Z");
    expect(liveStatus({ ...straddling, outcome: null }, at("2026-10-12T01:00:00Z"), 24)).toBe("due-soon");
    expect(liveStatus({ ...straddling, outcome: null }, at("2026-10-12T09:00:00Z"), 24)).toBe("overdue");
    expect(settleOutcome(straddling, at("2026-10-12T20:00:00Z"), 24)).toBe("missed");
  });

  it("settles a ticked flag like any John", () => {
    const ticked = { ...flag, doneAt: at("2026-10-09T09:00:00Z") };
    expect(settleOutcome(ticked, at("2026-10-10T09:00:00Z"), 24)).toBe("late");
  });
});
