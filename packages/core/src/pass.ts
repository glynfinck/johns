import { tz } from "@date-fns/tz";
import { format } from "date-fns";

import { PASS_COPY } from "./copy";
import type { Currency } from "./domain";
import { formatMoney } from "./money";

// The House Pass (docs/specs/house-pass.md): one subscription per house that
// unlocks the extras for everyone in it. Running a fair house stays free.

/**
 * Whether a house without the Pass loses the extras. Off until the store
 * release: until then every house keeps everything, and the Pass is only
 * shown. Turning it on is the one change that starts locking.
 */
export const PASS_ENFORCED = false;

/** How long every new house has the Pass free, from when it's made. */
export const PASS_TRIAL_DAYS = 30;

/** Weeks of history every house sees; older weeks need the Pass. */
export const PASS_FREE_HISTORY_WEEKS = 4;

export const PASS_PLANS = ["trial", "monthly", "yearly", "founding"] as const;
export type PassPlan = (typeof PASS_PLANS)[number];

/** What the Pass unlocks. Everything else is free for every house. */
export const PASS_FEATURES = ["stake", "table", "photos", "history"] as const;
export type PassFeature = (typeof PASS_FEATURES)[number];

export interface HousePass {
  plan: PassPlan;
  /** When it ends; null only for a Founding house, whose Pass never does. */
  until: Date | null;
  /** Who bought it; null for the free month or a Founding house given free. */
  buyerId: string | null;
}

/** A house row's Pass. An unknown plan reads as an ended free month, so it never unlocks by mistake. */
export function passOf(row: { pass_plan: string; pass_until: string | null; pass_buyer: string | null }): HousePass {
  const plan = (PASS_PLANS as readonly string[]).includes(row.pass_plan) ? (row.pass_plan as PassPlan) : "trial";
  const until = row.pass_until ? new Date(row.pass_until) : null;
  if (plan === "founding") return { plan, until: null, buyerId: row.pass_buyer };
  return { plan, until: until ?? new Date(0), buyerId: row.pass_buyer };
}

/** Whether the house has the Pass at `now`: Founding, or not yet ended. */
export function hasPass(pass: HousePass, now: Date): boolean {
  if (pass.plan === "founding") return true;
  return pass.until !== null && pass.until.getTime() > now.getTime();
}

/** Whether the extras are open to this house at `now`: always, until the Pass is enforced. */
export function passUnlocked(pass: HousePass, now: Date, enforced: boolean = PASS_ENFORCED): boolean {
  return !enforced || hasPass(pass, now);
}

/** Whole days left on a Pass that ends, counting a part day as a day; 0 once it has; null for Founding. */
export function passDaysLeft(pass: HousePass, now: Date): number | null {
  if (pass.until === null) return null;
  const ms = pass.until.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/** The Pass in a few words, for its row on House: "Founding house", "Free month · 12 days left", "Yearly · renews 12 Nov". */
export function passLine(pass: HousePass, now: Date, zone: string): string {
  if (pass.plan === "founding") return PASS_COPY.founding;
  const day = format(pass.until!, "d MMM", { in: tz(zone) });
  const left = passDaysLeft(pass, now)!;
  if (left === 0) return pass.plan === "trial" ? PASS_COPY.trialEnded : PASS_COPY.ended(day);
  if (pass.plan === "trial") return PASS_COPY.trialLeft(left);
  return PASS_COPY.renews(pass.plan === "yearly" ? PASS_COPY.yearly : PASS_COPY.monthly, day);
}

/**
 * The prices shown before the stores give their own, in minor units, per
 * house currency. The stores' local price tiers replace these once buying
 * opens; they're set to land on the same tiers.
 */
export const PASS_PRICES: Record<Currency, { yearly: number; monthly: number; founding: number }> = {
  USD: { yearly: 2999, monthly: 399, founding: 4900 },
  CAD: { yearly: 3999, monthly: 499, founding: 6499 },
  GBP: { yearly: 2499, monthly: 349, founding: 3999 },
  EUR: { yearly: 2999, monthly: 399, founding: 4900 },
};

export interface PassOffer {
  plan: Exclude<PassPlan, "trial">;
  label: string;
  price: string;
  meta: string;
}

/** The plans on the Pass page, Yearly first (the one picked): label, price and what it works out at. */
export function passOffers(currency: Currency): PassOffer[] {
  const p = PASS_PRICES[currency];
  return [
    { plan: "yearly", label: PASS_COPY.yearly, price: PASS_COPY.perYear(formatMoney(p.yearly, currency)), meta: PASS_COPY.perMonthish(formatMoney(Math.round(p.yearly / 12), currency)) },
    { plan: "monthly", label: PASS_COPY.monthly, price: PASS_COPY.perMonth(formatMoney(p.monthly, currency)), meta: PASS_COPY.monthlyMeta },
    { plan: "founding", label: PASS_COPY.foundingPlan, price: PASS_COPY.once(formatMoney(p.founding, currency)), meta: PASS_COPY.foundingMeta },
  ];
}
