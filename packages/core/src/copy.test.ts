import { describe, expect, it } from "vitest";

import { APP_NAME, FRONT_DOOR, SIGN_IN_COPY, TAGLINE } from "./copy";

const signIn = Object.values(SIGN_IN_COPY).flatMap((value) =>
  typeof value === "function" ? [value("Google"), value("Apple")] : [value],
);
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
