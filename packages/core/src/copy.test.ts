import { describe, expect, it } from "vitest";

import { APP_NAME, FRONT_DOOR, JOIN_COPY, NEW_HOUSE_COPY, NO_HOUSE_COPY, SIGN_IN_COPY, TAGLINE } from "./copy";

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
