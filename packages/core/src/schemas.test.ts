import { describe, expect, it } from "vitest";

import {
  CastVote,
  CreateHouse,
  disputeProblem,
  FreshRequest,
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  JoinCode,
  MoveResponse,
  normaliseJoinCode,
  RaiseDispute,
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

describe("RaiseDispute", () => {
  const assignmentId = "8f14e45f-ceea-467f-a8f5-2fbf7c2d9b1a";
  const message = (input: unknown) => RaiseDispute.safeParse(input).error?.issues[0]?.message;

  it("takes the John and the reason, tidied", () => {
    expect(RaiseDispute.parse({ assignmentId, reason: "  Bins still full  " })).toEqual({
      assignmentId,
      reason: "Bins still full",
    });
    expect(RaiseDispute.parse({ assignmentId, reason: "x".repeat(280) }).reason).toHaveLength(280);
  });

  it("asks for a reason, and a short one, in words", () => {
    expect(message({ assignmentId, reason: "" })).toBe("Say what's wrong with it.");
    expect(message({ assignmentId, reason: "   " })).toBe("Say what's wrong with it.");
    expect(message({ assignmentId, reason: "x".repeat(281) })).toBe("Keep it under 280 characters.");
  });

  it("refuses anything but a John's id", () => {
    expect(RaiseDispute.safeParse({ assignmentId: "a1", reason: "Still full" }).success).toBe(false);
    expect(RaiseDispute.safeParse({ reason: "Still full" }).success).toBe(false);
  });

  it("says what's wrong in one sentence, the reason's first", () => {
    const problem = (input: unknown) => disputeProblem(RaiseDispute.safeParse(input).error!.issues);
    expect(problem({ assignmentId, reason: "" })).toBe("Say what's wrong with it.");
    expect(problem({ assignmentId: "a1", reason: "" })).toBe("Say what's wrong with it.");
    expect(problem({ assignmentId: "a1", reason: "Still full" })).toBe("Say which John to dispute.");
    expect(problem(null)).toBe("Say which John to dispute.");
    expect(disputeProblem([])).toBe("Say which John to dispute.");
  });
});

describe("CastVote and MoveResponse", () => {
  it("takes a yes or a no, and nothing else", () => {
    expect(CastVote.parse({ uphold: true })).toEqual({ uphold: true });
    expect(CastVote.parse({ uphold: false })).toEqual({ uphold: false });
    expect(CastVote.safeParse({ uphold: "yes" }).success).toBe(false);
    expect(CastVote.safeParse({}).success).toBe(false);
  });

  it("answers ok", () => {
    expect(MoveResponse.parse({ ok: true })).toEqual({ ok: true });
    expect(MoveResponse.safeParse({ ok: false }).success).toBe(false);
  });
});
