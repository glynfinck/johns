# The House Pass

## What it does

One subscription per house. Any housemate can buy it, and everyone in the
house gets the extras: the Stake, the Table and its perks, photo receipts,
and history beyond four weeks. Running a fair house stays free for every
house: the deal, the housemate check, reminders, covering, on-call Johns and
time away. No ads.

Every new house gets the Pass free for its first 30 days. Every house made
before the Pass existed is a Founding house, with the Pass for life.

## Plans

| Plan | USD | GBP | EUR | CAD |
| --- | --- | --- | --- | --- |
| Yearly (the default) | 29.99 | 24.99 | 29.99 | 39.99 |
| Monthly | 3.99 | 3.49 | 3.99 | 4.99 |
| Founding house, once, for the first 3 months after the store release | 49 | 39.99 | 49 | 64.99 |

`PASS_PRICES` in `@app/core` (`pass.ts`) holds these until the stores give
their own local prices.

## Inputs and outputs

- `houses.pass_plan` (`trial`, `monthly`, `yearly`, `founding`),
  `houses.pass_until` (null only for Founding) and `houses.pass_buyer`.
  Written only by the service role; housemates read them with the house.
- `@app/core` `pass.ts`: `passOf`, `hasPass`, `passUnlocked`, `passLine`,
  `passOffers`, and `PASS_ENFORCED`, the one switch.
- House shows a House Pass row (`PassSection`) that pushes `/house/pass`:
  where the house stands, what the Pass includes, and the plans.

## What happens without the Pass (once `PASS_ENFORCED` is on)

- The Stake: settled Johns forfeit nothing (the engine's `settleDue`).
  Months already counted still close.
- Perks: streaks still count, but closing a week earns no immunity or swap
  tokens (the engine's `closeWeeks`).
- House shows a row to the Pass page in place of the month card and the
  Table.
- Nothing is ever deleted. Buying the Pass again brings everything back.

## Still to build

1. Photo receipts and history beyond four weeks lock with the switch, with
   the database checks (`mark_done`'s photo, `use_immunity`, `use_swap`) in
   the same change.
2. Store purchases: RevenueCat (`react-native-purchases`, a development
   build), one RevenueCat customer per house (`house_<id>`), Restore
   purchases.
3. Web purchases: Stripe Checkout through RevenueCat. The iOS app never links
   out to the web price.
4. A RevenueCat webhook to `apps/api` that writes the three columns, and a
   refresh on open so a missed webhook heals itself.
5. At the store release, a migration that makes every house made before it
   a Founding house, then `PASS_ENFORCED = true`.

## Edge cases

- The buyer leaves: the Pass runs to the end of what was paid.
- An unknown plan, or a paid plan with no end, reads as ended.
- Days left count a part day as a day; the renewal day is in the house's
  time zone.

## Platforms

The same on iOS, Android and web. Buying differs per platform (the stores on
phones, Stripe on the web) and waits for the store release.

## Done when

- [x] A new house starts a 30-day free month; existing houses are Founding.
- [x] Nobody but the service role can write the Pass.
- [x] House shows the Pass row and page on every platform.
- [x] With the switch on, a house without the Pass forfeits nothing and earns no perks.
- [ ] Buying works on iOS, Android and web.
