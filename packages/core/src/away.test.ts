import { describe, expect, it } from "vitest";

import {
  awayDays,
  awayOn,
  awayPeriod,
  awayThisWeek,
  currentOrNext,
  datesBetween,
  isoDayOf,
  remaining,
  shiftMonth,
  type AwayPeriod,
} from "./away";
import { addDaysTo, localDate } from "./week";

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

describe("awayPeriod", () => {
  it("reads a period from its row", () => {
    expect(awayPeriod({ id: "p1", user_id: "ben", starts_on: "2026-10-26", ends_on: "2026-10-28", note: "Lisbon" })).toEqual({
      id: "p1",
      userId: "ben",
      startsOn: "2026-10-26",
      endsOn: "2026-10-28",
      note: "Lisbon",
    });
  });
});

describe("isoDayOf", () => {
  it("names a local date's day, Monday 1 to Sunday 7", () => {
    expect(isoDayOf("2026-10-26")).toBe(1);
    expect(isoDayOf("2026-10-25")).toBe(7);
    expect(isoDayOf("2024-02-29")).toBe(4);
    // The night the clocks go back in London changes nothing: dates have no zone.
    expect(isoDayOf("2026-10-25")).toBe(isoDayOf("2026-11-01"));
  });
});

describe("awayThisWeek", () => {
  const week = "2026-10-19";

  it("says which days of the week someone is away", () => {
    expect(awayThisWeek([ben("2026-10-21", "2026-10-23")], "ben", week)).toBe("Away 21–23 Oct");
    expect(awayThisWeek([ben("2026-10-25", "2026-10-30")], "ben", week)).toBe("Away Sun 25 Oct");
  });

  it("says all week for a trip that covers it, and nothing for anyone home", () => {
    expect(awayThisWeek([ben("2026-10-10", "2026-11-10")], "ben", week)).toBe("Away all week");
    expect(awayThisWeek([ben("2026-10-26", "2026-10-30")], "ben", week)).toBeNull();
    expect(awayThisWeek([ben("2026-10-21", "2026-10-23")], "ava", week)).toBeNull();
    expect(awayThisWeek([], "ben", week)).toBeNull();
  });
});

describe("shiftMonth", () => {
  it("moves a month on or back, over the year's edge", () => {
    expect(shiftMonth("2026-10", 1)).toBe("2026-11");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-10", 0)).toBe("2026-10");
    expect(shiftMonth("2026-10", 14)).toBe("2027-12");
  });
});
