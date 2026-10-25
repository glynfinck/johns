import { currencyForCountry, type Currency } from '@app/core';
import { getCalendars, getLocales } from 'expo-localization';

// Where this phone is, for a new house's defaults, as the web uses Vercel's
// geo headers. The house can change both later.

/** The phone's time zone, or London when it won't say. */
export function deviceTimeZone(): string {
  return getCalendars()[0]?.timeZone ?? 'Europe/London';
}

/** The currency for the phone's region: pounds anywhere the app doesn't know. */
export function deviceCurrency(): Currency {
  return currencyForCountry(getLocales()[0]?.regionCode);
}
