import { describe, expect, it } from "vitest";

import * as copy from "./copy";
import {
  APP_NAME,
  ERROR_COPY,
  AWAY_COPY,
  FOCUS_SHELL_COPY,
  DEAL_COPY,
  DISPUTE_COPY,
  FRONT_DOOR,
  GROUPS_COPY,
  HOUSE_PAGE_COPY,
  INVITE_COPY,
  JOHN_COPY,
  JOHN_LIST_COPY,
  JOIN_COPY,
  LOOK_LABEL,
  LOOKS,
  lookOf,
  MEMBERS_COPY,
  NEW_HOUSE_COPY,
  NOT_FOUND_COPY,
  NOT_DEALT_COPY,
  NO_HOUSE_COPY,
  PAGE_TITLE,
  pageTitle,
  PRIVACY_COPY,
  REMINDERS_COPY,
  RULES_COPY,
  SECTION_LABEL,
  SECTIONS,
  SHELL_COPY,
  SIGN_IN_COPY,
  STAKE_COPY,
  STAKE_HISTORY_COPY,
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

describe("JOHN_LIST_COPY", () => {
  it("says how often and when, short", () => {
    expect(JOHN_LIST_COPY.when(1, "Sunday", "21:00")).toBe("Every week · due Sun 21:00");
    expect(JOHN_LIST_COPY.when(4, "Monday", "09:30")).toBe("Every 4 weeks · due Mon 09:30");
    expect(JOHN_LIST_COPY.when(6, "Friday", "18:00")).toBe("Every 6 weeks · due Fri 18:00");
  });

  it("rounds the house's weekly effort", () => {
    expect(JOHN_LIST_COPY.perWeek(0)).toMatch(/^About 0 points a week/);
    expect(JOHN_LIST_COPY.perWeek(7.5)).toMatch(/^About 8 points a week/);
  });
});

describe("DEAL_COPY", () => {
  it("keeps the words the web's deal button has always had", () => {
    expect(DEAL_COPY.first).toBe("Hand out this week's Johns");
    expect(DEAL_COPY.again).toBe("Re-deal this week");
  });
});

describe("RULES_COPY", () => {
  it("names the amounts in the house's currency", () => {
    expect(RULES_COPY.stake("£")).toBe("Monthly stake (£)");
    expect(RULES_COPY.missed("€")).toBe("Missed forfeit (€)");
  });

  it("says each dispute window and make-up rate", () => {
    expect(RULES_COPY.disputeHours(0)).toBe("No disputes (honour system)");
    expect(RULES_COPY.disputeHours(48)).toBe("48 hours after a tick");
    for (const n of [100, 50, 0]) expect(RULES_COPY.makeupHint[n]).toBeTruthy();
    expect(RULES_COPY.phoneZone("America/New_York")).toBe("Use this phone’s: America/New York");
  });
});

describe("MEMBERS_COPY", () => {
  it("names who's being removed by their first name", () => {
    expect(MEMBERS_COPY.removeName("Ben Wall")).toBe("Remove Ben");
    expect(MEMBERS_COPY.removeName("Cal")).toBe("Remove Cal");
  });
});

describe("GROUPS_COPY", () => {
  it("names the group being edited", () => {
    expect(GROUPS_COPY.edit("Upstairs")).toBe("Edit Upstairs");
  });
});

describe("AWAY_COPY", () => {
  it("counts the Johns booking moved", () => {
    expect(AWAY_COPY.moved(1)).toBe("1 of your Johns falls due while you're away, so it's now due before you go.");
    expect(AWAY_COPY.moved(3)).toBe("3 of your Johns fall due while you're away, so they're now due before you go.");
  });

  it("tells you on Today when you're away, and what your share does", () => {
    expect(AWAY_COPY.banner("26–28 Oct", false)).toBe("You're away 26–28 Oct.");
    expect(AWAY_COPY.banner("Wed 28 Oct", true)).toBe("You're away until Wed 28 Oct.");
    expect(AWAY_COPY.bannerBody(100)).toMatch(/, but your share still counts/);
    expect(AWAY_COPY.bannerBody(50)).toMatch(/, but half your share still counts/);
    expect(AWAY_COPY.bannerBody(0)).toBe("Nobody hands you a John due while you’re gone.");
  });
});

describe("pageTitle", () => {
  it("names the page, then the app, as the web's tab does", () => {
    expect(pageTitle(PAGE_TITLE.today)).toBe("Today · Johns");
    expect(pageTitle(PAGE_TITLE.week)).toBe("This week · Johns");
    expect(pageTitle()).toBe("Johns");
    expect(pageTitle("")).toBe("Johns");
  });
});

describe("the pages around the house", () => {
  it("has privacy, not-found and error words", () => {
    expect(PRIVACY_COPY.paragraphs).toHaveLength(4);
    expect(PRIVACY_COPY.paragraphs.join(" ")).toMatch(/never moves money/);
    expect(NOT_FOUND_COPY.back).toBe("Back to your Johns");
    expect(ERROR_COPY.retry).toBe("Try again");
  });
});

describe("looks", () => {
  it("names day, night and auto", () => {
    expect(LOOKS.map((l) => LOOK_LABEL[l])).toEqual(["Day", "Night", "Auto"]);
  });

  it("reads a saved look, and anything else as following the device", () => {
    expect(lookOf("dark")).toBe("dark");
    expect(lookOf("light")).toBe("light");
    expect(lookOf("system")).toBe("system");
    expect(lookOf(null)).toBe("system");
    expect(lookOf(undefined)).toBe("system");
    expect(lookOf("sepia")).toBe("system");
  });
});

describe("REMINDERS_COPY", () => {
  it("tells an iPhone to install first", () => {
    expect(REMINDERS_COPY.unsupported).toMatch(/home screen/);
  });
});

describe("FOCUS_SHELL_COPY", () => {
  it("speaks Today's badge, and leaves a tab with none as its name", () => {
    expect(FOCUS_SHELL_COPY.tab("Today", 2)).toBe("Today, 2 waiting for your vote");
    expect(FOCUS_SHELL_COPY.tab("Today", 0)).toBe("Today");
    expect(FOCUS_SHELL_COPY.tab("Week", 0)).toBe("Week");
  });

  it("counts what a fold holds", () => {
    expect(FOCUS_SHELL_COPY.done(0)).toBe("Done (0)");
    expect(FOCUS_SHELL_COPY.done(2)).toBe("Done (2)");
  });
});

describe("STAKE_HISTORY_COPY", () => {
  it("says the stake under its title as House says it under the house's name", () => {
    expect(STAKE_HISTORY_COPY.sub("£20")).toBe("£20 a month each");
    expect(HOUSE_PAGE_COPY.sub(4, "£20").endsWith(STAKE_HISTORY_COPY.sub("£20"))).toBe(true);
  });
});

describe("Focus's word objects", () => {
  const FOCUS = [
    "NEXT_UP_COPY",
    "JOHN_SHEET_COPY",
    "WEEK_SUMMARY_COPY",
    "HOUSE_PAGE_COPY",
    "PERSON_COPY",
    "STAKE_HISTORY_COPY",
    "WALL_FEED_COPY",
    "HOUSE_LOWER_COPY",
    "SETUP_COPY",
    "FRONT_DOOR_COPY",
  ];

  it("sit together in the order of the app, one per part of it", () => {
    // Vitest keeps the module's exports in the order they're written.
    const names = Object.keys(copy).filter((name) => FOCUS.includes(name));
    expect(names).toEqual(FOCUS);
    for (const name of names) expect(typeof copy[name as keyof typeof copy]).toBe("object");
  });
});

/** Every sentence an export holds: strings, lists and objects of them (functions are tested one by one). */
function sentences(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(sentences);
  if (value && typeof value === "object") return Object.values(value).flatMap(sentences);
  return [];
}

describe("every word in copy.ts", () => {
  const all = Object.values(copy).flatMap(sentences);

  it("is there to check", () => {
    expect(all.length).toBeGreaterThan(100);
  });

  it("never calls it a rota or a chore app", () => {
    for (const text of all) expect(text).not.toMatch(/\brota\b|chore app/i);
  });

  it("carries no emoji", () => {
    for (const text of all) expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
