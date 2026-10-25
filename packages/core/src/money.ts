import type { Currency } from "./domain";

/**
 * Money is whole minor units everywhere (pence, cents). It becomes a
 * decimal only here, at the moment it is printed.
 */

const LOCALE: Record<Currency, string> = {
  GBP: "en-GB",
  CAD: "en-CA",
  USD: "en-US",
  EUR: "en-IE",
};

export function formatMoney(minor: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALE[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** "+£2", "−£3.50" — the sign is the point, so it is always shown. */
export function formatSigned(minor: number, currency: Currency): string {
  if (minor === 0) return formatMoney(0, currency);
  const body = formatMoney(Math.abs(minor), currency);
  return minor > 0 ? `+${body}` : `−${body}`;
}

/** Parse what someone typed into a money field ("2", "2.5", "£2.50") into minor units. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[^\d.,]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** An amount as a money field starts out: "20", or "2.50" when there are pence. The inverse of parseMoney. */
export function moneyInput(minor: number): string {
  return (minor / 100).toFixed(minor % 100 ? 2 : 0);
}

const EURO_ZONE = new Set([
  "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE",
  "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK",
]);

/** How each currency is marked before an amount: "£ GBP" in a picker. */
export const CURRENCY_SYMBOL: Record<Currency, string> = { GBP: "£", CAD: "$", USD: "$", EUR: "€" };

/**
 * A house's currency defaults to wherever it was set up (Vercel's
 * `x-vercel-ip-country` header). Anywhere else starts in pounds, and the
 * house can change it in settings.
 */
export function currencyForCountry(country: string | null | undefined): Currency {
  const c = country?.toUpperCase();
  if (c === "GB" || c === "IM" || c === "JE" || c === "GG") return "GBP";
  if (c === "CA") return "CAD";
  if (c === "US") return "USD";
  if (c && EURO_ZONE.has(c)) return "EUR";
  return "GBP";
}
