import { describe, expect, it } from "vitest";

import { CURRENCIES } from "./domain";
import {
  hasPass,
  PASS_ENFORCED,
  PASS_PRICES,
  passDaysLeft,
  passLine,
  passOf,
  passOffers,
  passUnlocked,
  type HousePass,
} from "./pass";

const now = new Date("2026-11-10T12:00:00Z");
const at = (iso: string) => new Date(iso);
const pass = (plan: HousePass["plan"], until: string | null): HousePass => ({
  plan,
  until: until ? at(until) : null,
  buyerId: null,
});

describe("passOf", () => {
  it("reads a house row", () => {
    expect(passOf({ pass_plan: "yearly", pass_until: "2027-11-10T12:00:00Z", pass_buyer: "u1" })).toEqual({
      plan: "yearly",
      until: at("2027-11-10T12:00:00Z"),
      buyerId: "u1",
    });
  });

  it("gives a Founding house no end, whatever the row says", () => {
    expect(passOf({ pass_plan: "founding", pass_until: "2026-01-01T00:00:00Z", pass_buyer: null }).until).toBeNull();
  });

  it("reads an unknown plan, or a missing end, as ended, so it never unlocks by mistake", () => {
    const odd = passOf({ pass_plan: "platinum", pass_until: null, pass_buyer: null });
    expect(odd.plan).toBe("trial");
    expect(hasPass(odd, now)).toBe(false);
    expect(hasPass(passOf({ pass_plan: "monthly", pass_until: null, pass_buyer: null }), now)).toBe(false);
  });
});

describe("hasPass", () => {
  it("is always true for a Founding house", () => {
    expect(hasPass(pass("founding", null), now)).toBe(true);
  });

  it("is true until the moment it ends, and false from then", () => {
    expect(hasPass(pass("trial", "2026-11-10T12:00:01Z"), now)).toBe(true);
    expect(hasPass(pass("trial", "2026-11-10T12:00:00Z"), now)).toBe(false);
    expect(hasPass(pass("yearly", "2026-11-01T00:00:00Z"), now)).toBe(false);
  });
});

describe("passUnlocked", () => {
  const ended = pass("monthly", "2026-11-01T00:00:00Z");

  it("unlocks every house while the Pass isn't enforced", () => {
    expect(PASS_ENFORCED).toBe(false);
    expect(passUnlocked(ended, now)).toBe(true);
  });

  it("follows the Pass once enforced", () => {
    expect(passUnlocked(ended, now, true)).toBe(false);
    expect(passUnlocked(pass("monthly", "2026-12-01T00:00:00Z"), now, true)).toBe(true);
    expect(passUnlocked(pass("founding", null), now, true)).toBe(true);
  });
});

describe("passDaysLeft", () => {
  it("counts a part day as a day", () => {
    expect(passDaysLeft(pass("trial", "2026-11-10T13:00:00Z"), now)).toBe(1);
    expect(passDaysLeft(pass("trial", "2026-11-22T12:00:00Z"), now)).toBe(12);
    expect(passDaysLeft(pass("trial", "2026-11-22T12:00:01Z"), now)).toBe(13);
  });

  it("is 0 once ended and null for Founding", () => {
    expect(passDaysLeft(pass("trial", "2026-11-10T12:00:00Z"), now)).toBe(0);
    expect(passDaysLeft(pass("trial", "2026-10-01T00:00:00Z"), now)).toBe(0);
    expect(passDaysLeft(pass("founding", null), now)).toBeNull();
  });
});

describe("passLine", () => {
  it("says each state in a few words", () => {
    expect(passLine(pass("founding", null), now, "Europe/London")).toBe("Founding house");
    expect(passLine(pass("trial", "2026-11-22T12:00:00Z"), now, "Europe/London")).toBe("Free month · 12 days left");
    expect(passLine(pass("trial", "2026-11-11T00:00:00Z"), now, "Europe/London")).toBe("Free month · 1 day left");
    expect(passLine(pass("trial", "2026-11-01T00:00:00Z"), now, "Europe/London")).toBe("Free month ended");
    expect(passLine(pass("yearly", "2027-11-12T12:00:00Z"), now, "Europe/London")).toBe("Yearly · renews 12 Nov");
    expect(passLine(pass("monthly", "2026-12-12T12:00:00Z"), now, "Europe/London")).toBe("Monthly · renews 12 Dec");
    expect(passLine(pass("monthly", "2026-11-02T12:00:00Z"), now, "Europe/London")).toBe("Ended 2 Nov");
  });

  it("names the day in the house's zone", () => {
    // 04:00 on the 13th in London is still the 12th in Vancouver.
    const late = pass("yearly", "2027-11-13T04:00:00Z");
    expect(passLine(late, now, "Europe/London")).toBe("Yearly · renews 13 Nov");
    expect(passLine(late, now, "America/Vancouver")).toBe("Yearly · renews 12 Nov");
  });
});

describe("passOffers", () => {
  it("puts Yearly first, with what it works out at a month", () => {
    const offers = passOffers("USD");
    expect(offers.map((o) => o.plan)).toEqual(["yearly", "monthly", "founding"]);
    expect(offers[0].price).toBe("$29.99 a year");
    expect(offers[0].meta).toBe("About $2.50 a month");
    expect(offers[1].price).toBe("$3.99 a month");
    expect(offers[2].price).toBe("$49 once");
  });

  it("has a whole-minor-unit price in every house currency, Yearly cheaper than twelve months", () => {
    for (const currency of CURRENCIES) {
      const p = PASS_PRICES[currency];
      for (const minor of [p.yearly, p.monthly, p.founding]) expect(Number.isInteger(minor) && minor > 0).toBe(true);
      expect(p.yearly).toBeLessThan(p.monthly * 12);
      expect(p.founding).toBeGreaterThan(p.yearly);
      expect(passOffers(currency)).toHaveLength(3);
    }
  });
});
