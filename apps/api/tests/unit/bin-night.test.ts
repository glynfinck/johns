import { readFileSync } from "node:fs";

import { BIN_NIGHT, cssVariables } from "@app/core";
import { describe, expect, it } from "vitest";

/**
 * The web's palette lives in app/globals.css and the native app's in
 * @app/core. Both ship until the Expo web build replaces this app, so this
 * fails the moment one changes without the other.
 */
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`globals.css has no ${selector} block`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

describe("Bin Night: globals.css and @app/core agree", () => {
  for (const [selector, scheme] of [
    [":root", BIN_NIGHT.light],
    [".dark", BIN_NIGHT.dark],
  ] as const) {
    it(`${selector} has every colour core has, with the same value`, () => {
      const web = block(selector);
      for (const [name, value] of Object.entries(cssVariables(scheme))) expect([name, web[name]]).toEqual([name, value]);
    });

    it(`${selector} has no colour core is missing`, () => {
      const core = cssVariables(scheme);
      const extra = Object.keys(block(selector)).filter((name) => name !== "--radius" && !(name in core));
      expect(extra).toEqual([]);
    });
  }

  it("has the same radius", () => {
    expect(block(":root")["--radius"]).toBe(`${BIN_NIGHT.radius / 16}rem`);
  });
});
