import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { releaseRefusal } from "./lib.mjs";

const OFF = { ios: false, android: false };
const ON = { ios: true, android: true };

describe("releaseRefusal", () => {
  it("refuses anything but ios and android, with the usage", () => {
    for (const platform of [undefined, "", "web", "IOS", "__proto__", "toString"]) {
      expect(releaseRefusal(platform, ON, true)).toEqual({
        code: 2,
        message: "Usage: npm run release:ios | npm run release:android",
      });
    }
  });

  it("refuses a store that is switched off, and names it", () => {
    expect(releaseRefusal("ios", OFF, true)?.message).toMatch(/^App Store releases are switched off/);
    expect(releaseRefusal("android", OFF, true)?.message).toMatch(/^Google Play releases are switched off/);
    expect(releaseRefusal("ios", OFF, true)?.code).toBe(1);
  });

  it("treats anything short of true as off", () => {
    for (const targets of [{}, null, undefined, { ios: "true" }, { ios: 1 }, { android: true }]) {
      expect(releaseRefusal("ios", targets, true)?.code).toBe(1);
    }
  });

  it("refuses a store that is on until EAS is configured", () => {
    expect(releaseRefusal("android", ON, false)?.message).toMatch(/eas\.json is missing/);
  });

  it("lets a store that is on, with EAS configured, go ahead", () => {
    expect(releaseRefusal("ios", ON, true)).toBeNull();
    expect(releaseRefusal("android", { ios: false, android: true }, true)).toBeNull();
  });

  it("reads release-targets.json as one switch per store", () => {
    const targets = JSON.parse(readFileSync(new URL("../../release-targets.json", import.meta.url), "utf8"));
    expect(Object.keys(targets).sort()).toEqual(["android", "ios"]);
    for (const value of Object.values(targets)) expect(typeof value).toBe("boolean");
  });
});
