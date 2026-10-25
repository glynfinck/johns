import { describe, expect, it } from "vitest";

import { CURRENCIES } from "./domain";
import { CURRENCY_SYMBOL, currencyForCountry, formatMoney, formatSigned, parseMoney } from "./money";
import { balances, forfeitFor, settleMonth, settleUp, type LedgerEntry } from "./stake";

const RULES = { lateForfeitMinor: 100, missedForfeitMinor: 300 };

describe("forfeitFor", () => {
  it("charges late and missed only", () => {
    expect(forfeitFor("late", RULES)).toBe(100);
    expect(forfeitFor("missed", RULES)).toBe(300);
    expect(forfeitFor("done", RULES)).toBe(0);
    expect(forfeitFor("excused", RULES)).toBe(0);
  });
});

/** The month's whole ledger: forfeits as written during it, plus its close. */
function monthLedger(ids: string[], stake: number, forfeits: { userId: string; amount: number }[]) {
  const s = settleMonth(ids, stake, forfeits);
  const entries: LedgerEntry[] = [
    ...forfeits.map((f) => ({ userId: f.userId, kind: "forfeit" as const, amount: -f.amount })),
    ...s.entries,
  ];
  return { s, entries, bal: balances(entries) };
}

describe("settleMonth", () => {
  it("shares one person's forfeits among the rest", () => {
    const { s, bal } = monthLedger(["a", "b", "c", "d"], 2000, [{ userId: "d", amount: 300 }]);
    expect(s.received).toEqual({ a: 100, b: 100, c: 100, d: 0 });
    expect(Object.fromEntries(bal)).toEqual({ a: 100, b: 100, c: 100, d: -300 });
  });

  it("always sums to zero", () => {
    const { bal } = monthLedger(["a", "b", "c"], 2000, [
      { userId: "a", amount: 100 },
      { userId: "b", amount: 300 },
      { userId: "b", amount: 300 },
      { userId: "c", amount: 100 },
    ]);
    expect([...bal.values()].reduce((x, y) => x + y, 0)).toBe(0);
  });

  it("gives the odd penny to the earliest members, consistently", () => {
    const { s } = monthLedger(["a", "b", "c", "d"], 2000, [{ userId: "a", amount: 100 }]);
    expect(s.received).toEqual({ a: 0, b: 34, c: 33, d: 33 });
  });

  it("never takes more than the stake", () => {
    const forfeits = Array.from({ length: 10 }, () => ({ userId: "slob", amount: 300 }));
    const { s, entries, bal } = monthLedger(["slob", "tidy"], 2000, forfeits);
    expect(s.forfeited.slob).toBe(2000);
    expect(entries).toContainEqual({ userId: "slob", kind: "cap_refund", amount: 1000 });
    expect(bal.get("slob")).toBe(-2000);
    expect(bal.get("tidy")).toBe(2000);
  });

  it("refunds everything in a house of one", () => {
    const { bal } = monthLedger(["solo"], 2000, [{ userId: "solo", amount: 300 }]);
    expect(bal.get("solo")).toBe(0);
  });

  it("includes someone who forfeited and then left", () => {
    const { bal } = monthLedger(["a", "b"], 2000, [{ userId: "gone", amount: 300 }]);
    expect(bal.get("gone")).toBe(-300);
    expect(bal.get("a")! + bal.get("b")!).toBe(300);
  });

  it("writes nothing for a clean month", () => {
    expect(settleMonth(["a", "b"], 2000, []).entries).toEqual([]);
  });
});

describe("settleUp", () => {
  it("clears every balance", () => {
    const bal = new Map([
      ["a", 100],
      ["b", 250],
      ["c", -50],
      ["d", -300],
    ]);
    const transfers = settleUp(bal);
    const after = new Map(bal);
    for (const t of transfers) {
      after.set(t.from, after.get(t.from)! + t.amount);
      after.set(t.to, after.get(t.to)! - t.amount);
    }
    expect([...after.values()].every((v) => v === 0)).toBe(true);
    expect(transfers.length).toBeLessThanOrEqual(3);
  });

  it("pays the biggest debt to the biggest credit first", () => {
    expect(settleUp(new Map([["x", -300], ["y", 200], ["z", 100]]))).toEqual([
      { from: "x", to: "y", amount: 200 },
      { from: "x", to: "z", amount: 100 },
    ]);
  });

  it("has nothing to do when everyone is square", () => {
    expect(settleUp(new Map([["a", 0]]))).toEqual([]);
  });
});

describe("money", () => {
  it("formats by currency, dropping zero pence", () => {
    expect(formatMoney(1400, "GBP")).toBe("£14");
    expect(formatMoney(250, "GBP")).toBe("£2.50");
    expect(formatMoney(2000, "CAD")).toBe("$20");
    expect(formatMoney(150, "EUR")).toBe("€1.50");
  });

  it("always shows a sign", () => {
    expect(formatSigned(200, "GBP")).toBe("+£2");
    expect(formatSigned(-350, "GBP")).toBe("−£3.50");
    expect(formatSigned(0, "GBP")).toBe("£0");
  });

  it("parses what people type", () => {
    expect(parseMoney("2")).toBe(200);
    expect(parseMoney("£2.5")).toBe(250);
    expect(parseMoney("2,75")).toBe(275);
    expect(parseMoney("1.234")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });

  it("guesses currency from the country", () => {
    expect(currencyForCountry("GB")).toBe("GBP");
    expect(currencyForCountry("ca")).toBe("CAD");
    expect(currencyForCountry("US")).toBe("USD");
    expect(currencyForCountry("IE")).toBe("EUR");
    expect(currencyForCountry(null)).toBe("GBP");
    expect(currencyForCountry("JP")).toBe("GBP");
  });
});

describe("CURRENCY_SYMBOL", () => {
  it("marks every currency a house can use", () => {
    expect(Object.keys(CURRENCY_SYMBOL).sort()).toEqual([...CURRENCIES].sort());
    expect(CURRENCY_SYMBOL.GBP).toBe("£");
    expect(CURRENCY_SYMBOL.EUR).toBe("€");
  });
});
