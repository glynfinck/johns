import { describe, expect, it } from "vitest";

import { APP_NAME, FRONT_DOOR, TAGLINE } from "./copy";

const words = [APP_NAME, TAGLINE, FRONT_DOOR.eyebrow, FRONT_DOOR.headline, ...FRONT_DOOR.points.flatMap((p) => [p.title, p.body])];

describe("the front door's words", () => {
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
