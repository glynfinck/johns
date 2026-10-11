import { describe, expect, it } from "vitest";

import {
  dateRange,
  dueLabel,
  firstName,
  formatBalance,
  initials,
  monthLabel,
  pointsLabel,
  relative,
  weekRange,
} from "@/lib/format";
import { weekWindow } from "@/lib/week";

const LONDON = "Europe/London";
// Wednesday 8 Oct 2026, 10:00 BST.
const now = new Date("2026-10-08T09:00:00Z");

describe("dueLabel", () => {
  it("reads relative days in the house's zone", () => {
    expect(dueLabel(new Date("2026-10-08T20:00:00Z"), now, LONDON)).toBe("Today 21:00");
    expect(dueLabel(new Date("2026-10-09T06:30:00Z"), now, LONDON)).toBe("Tomorrow 07:30");
    expect(dueLabel(new Date("2026-10-11T20:00:00Z"), now, LONDON)).toBe("Sun 21:00");
    expect(dueLabel(new Date("2026-10-07T17:00:00Z"), now, LONDON)).toBe("Yesterday 18:00");
    expect(dueLabel(new Date("2026-10-20T17:00:00Z"), now, LONDON)).toBe("Tue 20 Oct");
  });

  it("counts a late-night UTC time as the next local day", () => {
    // 23:30 UTC on the 8th is 00:30 BST on the 9th.
    expect(dueLabel(new Date("2026-10-08T23:30:00Z"), now, LONDON)).toBe("Tomorrow 00:30");
  });
});

describe("relative", () => {
  it("says how far off, either way", () => {
    expect(relative(new Date(now.getTime() + 3 * 3_600_000), now)).toBe("in 3h");
    expect(relative(new Date(now.getTime() - 20 * 60_000), now)).toBe("20 min ago");
    expect(relative(new Date(now.getTime() + 3 * 86_400_000), now)).toBe("in 3 days");
    // 35h45m is past the hours cut-off but rounds to one day.
    expect(relative(new Date(now.getTime() - 35.75 * 3_600_000), now)).toBe("1 day ago");
  });
});

describe("weekRange", () => {
  it("shows the last day, not the midnight after it", () => {
    const w = weekWindow(now, LONDON, 1);
    expect(weekRange(w.startsAt, w.endsAt, LONDON)).toBe("5–11 Oct");
    const spanning = weekWindow(new Date("2026-09-30T12:00:00Z"), LONDON, 1);
    expect(weekRange(spanning.startsAt, spanning.endsAt, LONDON)).toBe("28 Sep – 4 Oct");
  });
});

describe("names", () => {
  it("makes initials and first names", () => {
    expect(initials("Priya Shah")).toBe("PS");
    expect(initials("tom")).toBe("TO");
    expect(firstName("Priya Shah")).toBe("Priya");
    expect(monthLabel("2026-10")).toBe("October 2026");
  });
});

describe("pointsLabel", () => {
  it("counts one point as a pt", () => {
    expect(pointsLabel(1)).toBe("1 pt");
    expect(pointsLabel(4)).toBe("4 pts");
  });
});

describe("dateRange", () => {
  it("reads like a calendar", () => {
    expect(dateRange("2026-10-14", "2026-10-21")).toBe("14–21 Oct");
    expect(dateRange("2026-10-28", "2026-11-02")).toBe("28 Oct – 2 Nov");
    expect(dateRange("2026-10-16", "2026-10-16")).toBe("Fri 16 Oct");
  });
});

describe("formatBalance", () => {
  it("signs a balance to the half point", () => {
    expect(formatBalance(3.4)).toBe("+3.5");
    expect(formatBalance(-9)).toBe("−9");
    expect(formatBalance(0.1)).toBe("level");
  });
});
