import { describe, expect, it } from "vitest";

import { humanError } from "./errors";

describe("humanError", () => {
  it("turns the database's short codes into sentences", () => {
    expect(humanError({ message: "admins_only", code: "P0001" })).toBe("Only the house admins can do that.");
    expect(humanError({ message: "week_started" })).toBe(
      "Someone’s already ticked a John this week, so it can’t be re-dealt.",
    );
    expect(humanError({ message: "no_johns" })).toBe("Add at least one John first.");
  });

  it("finds the code inside a longer message, as the engine wraps it", () => {
    expect(humanError({ message: "deal_week: week_started" })).toMatch(/can’t be re-dealt/);
  });

  it("says a refused permission plainly, and anything else gently", () => {
    expect(humanError({ code: "42501", message: "permission denied for table johns" })).toBe("You can’t do that.");
    expect(humanError({ message: "connection reset" })).toBe("Something went wrong. Try again.");
    expect(humanError({})).toBe("Something went wrong. Try again.");
    expect(humanError(null)).toBe("Something went wrong. Try again.");
    expect(humanError(undefined)).toBe("Something went wrong. Try again.");
  });

  it("writes its apostrophes curly, as the rest of the copy does", () => {
    for (const code of ["own_john", "already_disputed", "week_started", "unknown_timezone", "more_than_owed", "not_yours"]) {
      expect(humanError({ message: code })).not.toContain("'");
    }
    expect(humanError({ code: "42501" })).not.toContain("'");
  });
});
