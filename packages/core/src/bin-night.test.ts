import { describe, expect, it } from "vitest";

import { BIN_NIGHT, cssVariables, lidColour, withAlpha } from "./bin-night";
import { CATEGORIES } from "./domain";

describe("Bin Night", () => {
  it("names the same tokens in daylight and after dark", () => {
    expect(Object.keys(BIN_NIGHT.dark).sort()).toEqual(Object.keys(BIN_NIGHT.light).sort());
    expect(Object.keys(BIN_NIGHT.dark.bin).sort()).toEqual([...CATEGORIES].sort());
    expect(Object.keys(BIN_NIGHT.light.bin).sort()).toEqual([...CATEGORIES].sort());
  });

  it("writes every colour as lower-case #rrggbb", () => {
    for (const scheme of [BIN_NIGHT.light, BIN_NIGHT.dark]) {
      for (const value of Object.values(cssVariables(scheme))) expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("names tokens as the web's CSS variables", () => {
    const vars = cssVariables(BIN_NIGHT.light);
    expect(vars["--background"]).toBe("#e7e9e5");
    expect(vars["--card-foreground"]).toBe("#16181a");
    expect(vars["--on-hivis"]).toBe("#16181a");
    expect(vars["--bin-errands"]).toBe("#6a3d9a");
    expect(Object.keys(vars)).toHaveLength(23 + CATEGORIES.length);
  });

  it("dresses an unknown kind of John in the other lid", () => {
    expect(lidColour(BIN_NIGHT.light, "kitchen")).toBe("#7a4e2d");
    expect(lidColour(BIN_NIGHT.dark, "bathroom")).toBe("#5e9be8");
    expect(lidColour(BIN_NIGHT.light, "garden")).toBe(BIN_NIGHT.light.bin.other);
    expect(lidColour(BIN_NIGHT.light, "")).toBe(BIN_NIGHT.light.bin.other);
  });

  it("keeps the floors lid teal, so no lid shares the done green", () => {
    expect(BIN_NIGHT.light.bin.floors).toBe("#0f7c7a");
    expect(BIN_NIGHT.dark.bin.floors).toBe("#4fbdb9");
    for (const scheme of [BIN_NIGHT.light, BIN_NIGHT.dark]) {
      expect(Object.values(scheme.bin)).not.toContain(scheme.good);
      expect(Object.values(scheme.bin)).not.toContain(scheme.hazard);
    }
  });

  it("adds an opacity the way the web's /15 does", () => {
    expect(withAlpha("#c8410c", 0.15)).toBe("#c8410c26");
    expect(withAlpha("#c8410c", 1)).toBe("#c8410cff");
    expect(withAlpha("#c8410c", 0)).toBe("#c8410c00");
    expect(withAlpha("#c8410c", 2)).toBe("#c8410cff");
    expect(withAlpha("#c8410c", -1)).toBe("#c8410c00");
  });
});
