import { describe, expect, it } from "vitest";

import { awayDays, awayOn, currentOrNext, datesBetween, remaining, type AwayPeriod } from "@/lib/away";
import { addDaysTo, localDate } from "@/lib/week";

const ben = (startsOn: string, endsOn: string, id = "p1"): AwayPeriod => ({
  id,
  userId: "ben",
  startsOn,
  endsOn,
  note: null,
});

describe("time away", () => {
  const trip = [ben("2026-10-14", "2026-10-18")];

  it("counts the first and last day as away", () => {
    expect(awayOn(trip, "ben", "2026-10-13")).toBe(false);
    expect(awayOn(trip, "ben", "2026-10-14")).toBe(true);
    expect(awayOn(trip, "ben", "2026-10-18")).toBe(true);
    expect(awayOn(trip, "ben", "2026-10-19")).toBe(false);
  });

  it("only counts the person who is away", () => {
    expect(awayOn(trip, "ava", "2026-10-15")).toBe(false);
  });

  it("lists the away days inside a week", () => {
    expect(awayDays(trip, "ben", "2026-10-12", "2026-10-18")).toEqual([
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
  });

  it("walks dates across a month end and a clock change", () => {
    expect(datesBetween("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(addDaysTo("2026-10-24", 2)).toBe("2026-10-26");
  });

  it("finds the period someone is in, or the next one", () => {
    const two = [ben("2026-11-01", "2026-11-03", "later"), ben("2026-10-14", "2026-10-18", "soon")];
    expect(currentOrNext(two, "ben", "2026-10-15")?.id).toBe("soon");
    expect(currentOrNext(two, "ben", "2026-10-20")?.id).toBe("later");
    expect(currentOrNext(two, "ben", "2026-11-04")).toBeNull();
  });

  it("knows what is left of a period from today", () => {
    expect(remaining(trip[0], "2026-10-10")).toEqual({ from: "2026-10-14", to: "2026-10-18" });
    expect(remaining(trip[0], "2026-10-16")).toEqual({ from: "2026-10-16", to: "2026-10-18" });
    expect(remaining(trip[0], "2026-10-19")).toBeNull();
  });

  it("reads a local date in the house's zone, not the server's", () => {
    // 23:30 UTC on the 13th is already the 14th in Auckland.
    expect(localDate(new Date("2026-10-13T23:30:00Z"), "Pacific/Auckland")).toBe("2026-10-14");
    expect(localDate(new Date("2026-10-13T23:30:00Z"), "Europe/London")).toBe("2026-10-14");
    expect(localDate(new Date("2026-10-13T22:30:00Z"), "Europe/London")).toBe("2026-10-13");
  });
});
