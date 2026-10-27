import { describe, expect, it } from "vitest";

import { canCover, coverOpensAt, liveStatus, settleOutcome, standsAt, tickWouldBe, type AssignmentFacts } from "./outcome";

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

describe("covering", () => {
  const covered = { ...base, doneAt: at("2026-10-08T22:00:00Z"), coveredBy: "glyn" };

  it("settles a cover as covered once it stands, never done or late", () => {
    expect(settleOutcome(covered, at("2026-10-09T21:59:00Z"), 24)).toBeNull();
    expect(settleOutcome(covered, at("2026-10-09T22:00:00Z"), 24)).toBe("covered");
    expect(settleOutcome(covered, at("2026-10-12T00:00:00Z"), 0)).toBe("covered");
  });

  it("holds a disputed cover like any tick", () => {
    expect(settleOutcome({ ...covered, disputeOpen: true }, at("2026-10-20T00:00:00Z"), 24)).toBeNull();
  });

  it("shows covered from the moment it's covered, and disputed while it's argued", () => {
    const now = at("2026-10-08T23:00:00Z");
    expect(liveStatus({ ...covered, outcome: null }, now, 24)).toBe("covered");
    expect(liveStatus({ ...covered, disputeOpen: true, outcome: null }, now, 24)).toBe("disputed");
    expect(liveStatus({ ...covered, outcome: "covered" }, now, 24)).toBe("covered");
  });

  it("opens the grace period after the due time", () => {
    expect(coverOpensAt(due, 3)).toEqual(at("2026-10-08T21:00:00Z"));
    expect(coverOpensAt(due, 0)).toEqual(due);
  });

  it("lets anyone else cover an undone John once the grace is up", () => {
    const a = { userId: "sam", doneAt: null, outcome: null, dueAt: due };
    expect(canCover(a, "glyn", at("2026-10-08T20:59:59Z"), 3)).toBe(false);
    expect(canCover(a, "glyn", at("2026-10-08T21:00:00Z"), 3)).toBe(true);
    expect(canCover(a, "glyn", due, 0)).toBe(true);
  });

  it("never offers a cover of your own, a ticked, excused or settled John", () => {
    const now = at("2026-10-10T00:00:00Z");
    const a = { userId: "sam", doneAt: null, outcome: null, dueAt: due };
    expect(canCover(a, "sam", now, 3)).toBe(false);
    expect(canCover({ ...a, doneAt: at("2026-10-09T00:00:00Z") }, "glyn", now, 3)).toBe(false);
    expect(canCover({ ...a, excused: true }, "glyn", now, 3)).toBe(false);
    expect(canCover({ ...a, outcome: "missed" }, "glyn", now, 3)).toBe(false);
  });
});
