import { describe, expect, it } from "vitest";

import {
  CreateHouse,
  FreshRequest,
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  JoinCode,
  normaliseJoinCode,
} from "./schemas";

describe("join codes", () => {
  it("tidies a code as people type it", () => {
    expect(normaliseJoinCode("ab3d-ef7h")).toBe("AB3DEF7H");
    expect(normaliseJoinCode(" AB 3D EF 7H ")).toBe("AB3DEF7H");
    expect(normaliseJoinCode("AB3DEF7H")).toBe("AB3DEF7H");
  });

  it("refuses what can't be a code", () => {
    expect(normaliseJoinCode("")).toBeNull();
    expect(normaliseJoinCode("AB3DEF7")).toBeNull();
    expect(normaliseJoinCode("AB3DEF7HJ")).toBeNull();
    // Look-alikes the database never makes.
    for (const c of ["0", "O", "1", "I", "L"]) expect(normaliseJoinCode(`AB3DEF7${c}`)).toBeNull();
    expect(normaliseJoinCode("AB3DÉF7H")).toBeNull();
    expect(normaliseJoinCode("AB3D/F7H")).toBeNull();
  });

  it("matches the database's alphabet and length", () => {
    expect(JOIN_CODE_ALPHABET).toBe("ABCDEFGHJKMNPQRSTUVWXYZ23456789");
    expect(JOIN_CODE_LENGTH).toBe(8);
    expect(JoinCode.parse("xyz2-3456")).toBe("XYZ23456");
    expect(JoinCode.safeParse("nope").success).toBe(false);
  });
});

describe("CreateHouse", () => {
  const house = { name: "  Flat 3 ", timezone: "Europe/London", currency: "GBP", weekStarts: "1" };

  it("trims the name and reads the week's first day as a number", () => {
    expect(CreateHouse.parse(house)).toEqual({ name: "Flat 3", timezone: "Europe/London", currency: "GBP", weekStarts: 1 });
  });

  it("asks for a name, and keeps it to sixty characters", () => {
    expect(CreateHouse.safeParse({ ...house, name: "   " }).error?.issues[0].message).toBe("Give the house a name.");
    expect(CreateHouse.safeParse({ ...house, name: "x".repeat(60) }).success).toBe(true);
    expect(CreateHouse.safeParse({ ...house, name: "x".repeat(61) }).success).toBe(false);
  });

  it("refuses an unknown currency or a day outside the week", () => {
    expect(CreateHouse.safeParse({ ...house, currency: "JPY" }).success).toBe(false);
    expect(CreateHouse.safeParse({ ...house, weekStarts: 0 }).success).toBe(false);
    expect(CreateHouse.safeParse({ ...house, weekStarts: 8 }).success).toBe(false);
    expect(CreateHouse.safeParse({ ...house, weekStarts: 1.5 }).success).toBe(false);
  });
});

describe("FreshRequest", () => {
  it("takes one house's id", () => {
    const houseId = "8f14e45f-ceea-467f-a8f5-2fbf7c2d9b1a";
    expect(FreshRequest.parse({ houseId })).toEqual({ houseId });
    expect(FreshRequest.safeParse({ houseId: "not-a-uuid" }).success).toBe(false);
    expect(FreshRequest.safeParse({}).success).toBe(false);
  });
});
