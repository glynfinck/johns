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
| Yearly (the default) | 49.99 | 39.99 | 49.99 | 64.99 |
| Monthly | 5.99 | 4.99 | 5.99 | 7.99 |
| Founding house, once, for the first 3 months after the store release | 49 | 39.99 | 49 | 64.99 |

`PASS_PRICES` in `@app/core` (`pass.ts`) holds these until the stores give
their own local prices.

The yearly and monthly prices went up from $29.99 and $3.99 on 30 Oct 2026,
before launch, so Founding is now a lifetime for the price of one year.
Check on 1 May 2027: if fewer than 3% of houses pay after their free month,
go down to $39.99 and £29.99 a year by moving the Stripe lookup keys.

## Inputs and outputs

- `houses.pass_plan` (`trial`, `monthly`, `yearly`, `founding`),
  `houses.pass_until` (null only for Founding) and `houses.pass_buyer`.
  Written only by the service role; housemates read them with the house.
- `@app/core` `pass.ts`: `passOf`, `hasPass`, `passUnlocked`, `passLine`,
  `passOffers`, and `PASS_ENFORCED`, the one switch.
- House shows a House Pass row (`PassSection`) that pushes `/house/pass`:
  where the house stands, what the Pass includes, and the plans.

## Buying on the web

Built straight on Stripe, so it doesn't wait for the stores. The iOS and
Android apps never link out to the web price.

- On the web, with `EXPO_PUBLIC_PASS_CHECKOUT=on`, the plans on the Pass
  page are buttons. One sends the browser to Stripe Checkout
  (`POST /api/pass/checkout`), in the house's currency, carrying the house
  and the buyer. Any housemate can buy.
- Bought during the free month, Yearly and Monthly first charge when the
  free month ends (`passFirstCharge`; Stripe needs at least two days), so
  nobody pays for days the house already has. Founding is one payment.
- Stripe's webhook (`POST /api/stripe/webhook`) checks Stripe's signature,
  reads the subscription again from Stripe, and writes the house's Pass by
  `passAfterSubscription`: a live subscription (active, trialing, past due)
  runs the Pass to the end of its period; an ended one stops it then, and a
  house still in its free month keeps the rest of it. A Founding payment
  makes the house Founding and stops any plan it was paying for renewing.
- `house_pass_billing` (service role only) holds the house's Stripe
  customer and its current subscription. Events for any other subscription
  leave the Pass alone, so an old plan ending can't undo a new one.
- The buyer, and only the buyer, gets Manage plan: Stripe's billing page,
  to switch plan, change card or cancel (`POST /api/pass/manage`).
- A house on a paid plan is offered only Founding; a Founding house nothing.
- Back from Checkout (`/house/pass?bought=1`) the page says thanks and reads
  the house again every few seconds until the Pass shows.

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
3. A RevenueCat webhook to `apps/api` that writes the three columns for
   store purchases, and a refresh on open so a missed webhook heals itself.
   RevenueCat can import the web's Stripe subscriptions then.
4. At the store release, a migration that makes every house made before it
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
- [x] Buying works on the web (Stripe), behind `EXPO_PUBLIC_PASS_CHECKOUT`.
- [ ] Buying works on iOS and Android.
