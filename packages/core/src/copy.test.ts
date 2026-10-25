import { describe, expect, it } from "vitest";

import {
  APP_NAME,
  DISPUTE_COPY,
  FRONT_DOOR,
  INVITE_COPY,
  JOHN_COPY,
  JOIN_COPY,
  NEW_HOUSE_COPY,
  NOT_DEALT_COPY,
  NO_HOUSE_COPY,
  SECTION_LABEL,
  SECTIONS,
  SHELL_COPY,
  SIGN_IN_COPY,
  STAKE_COPY,
  TABLE_COPY,
  TAGLINE,
  TODAY_COPY,
  WEEK_COPY,
} from "./copy";

const signIn = Object.values(SIGN_IN_COPY).flatMap((value) =>
  typeof value === "function" ? [value("Google"), value("Apple")] : [value],
);
const house = [
  ...Object.values(NEW_HOUSE_COPY),
  ...Object.values(NO_HOUSE_COPY),
  ...Object.values(JOIN_COPY).filter((value) => typeof value === "string"),
  JOIN_COPY.alreadyIn("Flat 3"),
  JOIN_COPY.livesHere(1),
  JOIN_COPY.livesHere(4),
  JOIN_COPY.join("Flat 3"),
];
const today = [
  ...[TODAY_COPY, JOHN_COPY, INVITE_COPY].flatMap((copy) => Object.values(copy).filter((v) => typeof v === "string")),
  TODAY_COPY.thisWeekRange("12–18 Oct"),
  TODAY_COPY.left(1),
  TODAY_COPY.left(3),
  TODAY_COPY.streak(1),
  TODAY_COPY.streak(4),
  TODAY_COPY.immunity(2),
  JOHN_COPY.standsIn("in 3 hours"),
  JOHN_COPY.disputed("Still filthy"),
  JOHN_COPY.votes(1, 2, "in 5 hours"),
  JOHN_COPY.dueBeforeYouGo("Fri 21:00"),
  NOT_DEALT_COPY.nothingThisWeek,
  NOT_DEALT_COPY.nothingThisWeekBody,
  NOT_DEALT_COPY.notYet,
  ...NOT_DEALT_COPY.adminSteps,
  NOT_DEALT_COPY.waitingFor("Ava"),
  INVITE_COPY.shareTitle("Flat 3"),
];
const words = [
  APP_NAME,
  TAGLINE,
  FRONT_DOOR.eyebrow,
  FRONT_DOOR.headline,
  FRONT_DOOR.signIn,
  FRONT_DOOR.start,
  FRONT_DOOR.join,
  ...FRONT_DOOR.points.flatMap((p) => [p.title, p.body]),
  ...signIn,
  ...house,
  ...today,
];

describe("the words before signing in", () => {
  it("never call it a rota or a chore app", () => {
    for (const text of words) expect(text).not.toMatch(/\brota\b|chore app/i);
  });

  it("carry no emoji", () => {
    for (const text of words) expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("names each point once", () => {
    const keys = FRONT_DOOR.points.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("SIGN_IN_COPY", () => {
  it("names the provider that didn't finish", () => {
    expect(SIGN_IN_COPY.failed("Google")).toBe("Google didn’t finish signing you in. Try again.");
    expect(SIGN_IN_COPY.failed("Apple")).toBe("Apple didn’t finish signing you in. Try again.");
  });
});

describe("JOIN_COPY", () => {
  it("counts the house in words", () => {
    expect(JOIN_COPY.livesHere(1)).toBe("1 person lives here. Join and you’re dealt Johns from next week.");
    expect(JOIN_COPY.livesHere(3)).toBe("3 people live here. Join and you’re dealt Johns from next week.");
    expect(JOIN_COPY.alreadyIn("Flat 3")).toBe("You’re already in Flat 3");
    expect(JOIN_COPY.join("Flat 3")).toBe("Join Flat 3");
  });
});

describe("TODAY_COPY", () => {
  it("counts in words", () => {
    expect(TODAY_COPY.left(1)).toBe("John left this week");
    expect(TODAY_COPY.left(0)).toBe("Johns left this week");
    expect(TODAY_COPY.streak(1)).toBe("1 week");
    expect(TODAY_COPY.streak(2)).toBe("2 weeks");
  });
});

describe("JOHN_COPY's time away", () => {
  it("says whose trip pulled a John forward", () => {
    expect(JOHN_COPY.dueBeforeYouGo("sat 09:00")).toBe("Due before you go: it was due sat 09:00, while you're away.");
    expect(JOHN_COPY.dueBeforeTheyGo("Ben", "sat 09:00")).toBe("Due before Ben goes: it was due sat 09:00, while they're away.");
  });
});

describe("WEEK_COPY", () => {
  it("counts and tallies in words", () => {
    expect(WEEK_COPY.doneOf(0, 0)).toBe("0 of 0");
    expect(WEEK_COPY.doneOf(3, 7)).toBe("3 of 7");
    expect(WEEK_COPY.tally(1, 0, "in 5h")).toBe("1 not done · 0 fine · closes in 5h");
    expect(WEEK_COPY.disputeOn("Bins", "Still full")).toBe("Bins: “Still full”");
  });
});

describe("DISPUTE_COPY", () => {
  it("names the John and whose tick it is", () => {
    expect(DISPUTE_COPY.title("Bins")).toBe("Was Bins really done?");
    expect(DISPUTE_COPY.body("Ben")).toBe(
      "Ben’s tick goes to a house vote. If the house agrees with you, the John opens again.",
    );
  });
});

describe("SECTIONS", () => {
  it("names every screen once, in the house's words", () => {
    expect(new Set(SECTIONS).size).toBe(SECTIONS.length);
    expect(SECTIONS.map((s) => SECTION_LABEL[s])).toEqual(["Today", "Week", "Wall", "Table", "Stake", "House"]);
  });

  it("counts the house and your standing in words", () => {
    expect(SHELL_COPY.housemates(1)).toBe("1 housemate");
    expect(SHELL_COPY.housemates(4)).toBe("4 housemates");
    expect(SHELL_COPY.standing(0, 1)).toBe("0-week streak · 1 token");
    expect(SHELL_COPY.standing(5, 0)).toBe("5-week streak · 0 tokens");
  });
});

describe("TABLE_COPY", () => {
  it("tells a record without the zeros", () => {
    expect(TABLE_COPY.record({ done: 3, late: 0, missed: 0 })).toBe("3 done");
    expect(TABLE_COPY.record({ done: 0, late: 1, missed: 2 })).toBe("0 done · 1 late · 2 missed");
  });

  it("says where you stand against your share", () => {
    expect(TABLE_COPY.shareLine(-4, 1)).toMatch(/for about 1 week\.$/);
    expect(TABLE_COPY.shareLine(-0.5, 3)).toMatch(/^Points behind your share.*about 3 weeks\.$/);
    expect(TABLE_COPY.shareLine(0.5, 0)).toBe("Points ahead of your share, so the next weeks go a little easier on you.");
    expect(TABLE_COPY.shareLine(0.49, 0)).toBe("You've done your share.");
    expect(TABLE_COPY.shareLine(-0.49, 0)).toBe("You've done your share.");
  });

  it("names the rules' numbers from the rules", () => {
    expect(TABLE_COPY.sharesBody).toMatch(/last 12 weeks/);
    expect(TABLE_COPY.rules[1].body).toMatch(/^Every 4 clean weeks/);
    expect(TABLE_COPY.weeks(1)).toBe("1 week");
  });
});

describe("STAKE_COPY", () => {
  it("puts the house's sums into sentences", () => {
    expect(STAKE_COPY.eyebrow("£20")).toBe("£20 each, every month");
    expect(STAKE_COPY.soFarBody("£1", "£3")).toMatch(/^Late costs £1, missed costs £3, and nobody/);
    expect(STAKE_COPY.forfeitedSoFar(null)).toBe("Nothing forfeited so far.");
    expect(STAKE_COPY.forfeitedSoFar("£4")).toBe("£4 forfeited so far.");
  });

  it("says which side of a payment you were on", () => {
    expect(STAKE_COPY.counterparty(500, "Ben")).toBe("to Ben");
    expect(STAKE_COPY.counterparty(-500, "Ava")).toBe("from Ava");
  });

  it("names every kind of ledger entry", () => {
    for (const kind of ["forfeit", "cap_refund", "share", "payment"]) expect(STAKE_COPY.kind[kind]).toBeTruthy();
  });
});
