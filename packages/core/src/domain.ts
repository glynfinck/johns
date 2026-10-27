/**
 * The words the whole app shares. Pure data, no I/O: everything in `lib/`
 * that decides something imports its vocabulary from here, and so do the
 * migrations' CHECK constraints (keep the two lists in step).
 */

/** What kind of John it is. Each one wears its bin-lid colour (globals.css). */
export const CATEGORIES = [
  "kitchen",
  "bathroom",
  "bins",
  "floors",
  "errands",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  bins: "Bins & recycling",
  floors: "Floors & hoovering",
  errands: "Errands & shopping",
  other: "Everything else",
};

/**
 * A kind as a line about one John says it, short enough to leave room for
 * when: "Bins · today 21:00", "Other · was due Tue".
 */
export const CATEGORY_SHORT: Record<Category, string> = {
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  bins: "Bins",
  floors: "Floors",
  errands: "Errands",
  other: "Other",
};

/**
 * When a John needs doing: on a set day each week it comes round, or on call,
 * whenever someone flags it (the bins when they're full).
 */
export const JOHN_WHEN = ["day", "on_call"] as const;
export type JohnWhen = (typeof JOHN_WHEN)[number];

/** How long whoever is on call has to do a flagged John, in hours. */
export const RESPOND_HOURS = [2, 4, 8, 12, 24, 48] as const;

/**
 * How a John ended, once the house can no longer argue about it.
 * - `done`: ticked by its due time and nobody upheld a dispute.
 * - `late`: ticked after its due time but before the week closed.
 * - `missed`: the week closed without a tick that stood.
 * - `excused`: an immunity token was spent on it.
 */
export const OUTCOMES = ["done", "late", "missed", "excused"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** The four currencies a house can keep its Stake in. All have 2 decimals. */
export const CURRENCIES = ["GBP", "CAD", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** ISO day of week: 1 = Monday … 7 = Sunday. */
export type IsoDow = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DOW_LABEL: Record<IsoDow, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

/** The knobs a house turns. Money is always in minor units (pence, cents). */
export interface HouseRules {
  timezone: string;
  currency: Currency;
  weekStarts: IsoDow;
  stakeMinor: number;
  lateForfeitMinor: number;
  missedForfeitMinor: number;
  /** How long a tick can be disputed before it stands. */
  disputeHours: number;
}

export const DEFAULT_RULES: Omit<HouseRules, "timezone" | "currency"> = {
  weekStarts: 1,
  stakeMinor: 2000,
  lateForfeitMinor: 100,
  missedForfeitMinor: 300,
  disputeHours: 24,
};
