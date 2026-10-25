import { describe, expect, it } from "vitest";

import { PROOF_LONG_EDGE, proofPath, proofSize } from "./proof";

describe("proofSize", () => {
  it("keeps a photo that already fits", () => {
    expect(proofSize(1200, 900)).toEqual({ width: 1200, height: 900 });
    expect(proofSize(PROOF_LONG_EDGE, PROOF_LONG_EDGE)).toEqual({ width: 1600, height: 1600 });
    expect(proofSize(1, 1)).toEqual({ width: 1, height: 1 });
  });

  it("brings the long side down to the limit, keeping the shape", () => {
    expect(proofSize(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(proofSize(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(proofSize(3200, 3200)).toEqual({ width: 1600, height: 1600 });
  });

  it("rounds to whole pixels, and never to nothing", () => {
    expect(proofSize(4000, 3001)).toEqual({ width: 1600, height: 1200 }); // 1200.4
    expect(proofSize(3001, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(proofSize(1601, 1)).toEqual({ width: 1600, height: 1 }); // 0.999…
    expect(proofSize(100_000, 10)).toEqual({ width: 1600, height: 1 }); // 0.16
  });

  it("refuses a size that isn't one", () => {
    for (const [w, h] of [
      [0, 100],
      [100, 0],
      [-4032, 3024],
      [Number.NaN, 10],
      [Number.POSITIVE_INFINITY, 10],
    ]) {
      expect(() => proofSize(w, h)).toThrow(RangeError);
    }
  });
});

describe("proofPath", () => {
  it("files a receipt under its house and its John", () => {
    expect(proofPath("h1", "a1", "f0e1")).toBe("h1/a1/f0e1.jpg");
  });

  it("refuses an empty part, or one that would add a folder", () => {
    expect(() => proofPath("", "a1", "f")).toThrow(RangeError);
    expect(() => proofPath("h1", "", "f")).toThrow(RangeError);
    expect(() => proofPath("h1", "a1", "")).toThrow(RangeError);
    expect(() => proofPath("h1", "a1/../a2", "f")).toThrow(RangeError);
  });
});
