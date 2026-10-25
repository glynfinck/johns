import { describe, expect, it } from "vitest";

import { verdict } from "./dispute";

const closesAt = new Date("2026-10-09T12:00:00Z");
const before = new Date("2026-10-09T08:00:00Z");

describe("verdict", () => {
  it("decides at once on a majority", () => {
    // Four housemates: three may vote, two is a majority.
    expect(verdict({ eligible: 3, uphold: 2, reject: 0, closesAt }, before)).toBe("upheld");
    expect(verdict({ eligible: 3, uphold: 1, reject: 2, closesAt }, before)).toBe("rejected");
  });

  it("waits while it is still open and undecided", () => {
    expect(verdict({ eligible: 3, uphold: 1, reject: 0, closesAt }, before)).toBeNull();
    expect(verdict({ eligible: 4, uphold: 2, reject: 1, closesAt }, before)).toBeNull();
  });

  it("closes on time with the larger side", () => {
    expect(verdict({ eligible: 5, uphold: 2, reject: 1, closesAt }, closesAt)).toBe("upheld");
    expect(verdict({ eligible: 5, uphold: 1, reject: 1, closesAt }, closesAt)).toBe("rejected");
  });

  it("gives a tie to the tick once everyone has voted", () => {
    expect(verdict({ eligible: 4, uphold: 2, reject: 2, closesAt }, before)).toBe("rejected");
  });

  it("lets the only other housemate decide alone", () => {
    expect(verdict({ eligible: 1, uphold: 1, reject: 0, closesAt }, before)).toBe("upheld");
  });
});
