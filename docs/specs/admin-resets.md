# Admins and resets

Design: https://claude.ai/artifact/WMLo693iKzjmhLMyzE5snL (Glyn picked the
whole package, 29 Oct 2026). This is step 2 of 3. Step 1 is undo and
History (`docs/specs/undo-history.md`); step 3 is Ask Jonz for both.

## Admins

House › Setup › **Admins** lists who looks after the house, with
"Add an admin" (pick a housemate who isn't one) and Remove beside every
other admin. Both happen at once and offer Undo in the toast. A house always
keeps one admin (the database checks). The only admin leaves from House by
picking who looks after the house: "Make Sam admin and leave" is one step
(`hand_over`).

## The six resets

| Reset | Where | What it does |
| --- | --- | --- |
| Change one result | John sheet › Change result (admins) | Done, late, missed or let off. Its forfeit goes or comes. The Track record square gets an amber dot. |
| Reset one person's week | Their page | Their Johns this week go back to open: ticks, covers and their forfeits come off. |
| Reset this week | Week ••• | Everyone's Johns this week go back to open; flags and open disputes are cleared. |
| Re-deal this week | Week ••• | As reset, then the week is dealt again from the list as it is now. Allowed after ticks now. Only this week. |
| Skip this week | Week ••• | The week counts for nothing: no shares, no credit, no forfeits. Whatever wasn't done is let off. Streaks neither grow nor break. The Track record shows it grey. |
| Let everyone off a month | Stake history | The month's forfeits go. Marks stay; the month is labelled "Let off". |

Every reset opens the same **reset sheet** (`components/reset-sheet.tsx`). It
asks the server what the reset would change (`POST /api/resets` without
`apply`) and says it in numbers before anything changes: ticks cleared per
person, balances, the Stake, the Track record, who gets a notification, and
how long it can be undone. The hazard button names the reset. Afterwards the
toast offers Undo, and History keeps it.

Resetting and re-dealing only work on a week that hasn't closed; a closed
week is fixed one result at a time. A reopened John that is past due counts
as late if it's ticked now, and missed at the week's end, and the sheet says
so.

## Money

Shared-out money is never rewritten. When a forfeit goes (or comes) in a
month whose Stake is already shared out, it becomes a **correction** in the
month that's open: a `correction` ledger row giving the person the money back
(or charging it), and the rest of the house paying (or getting) it between
them, so the month still sums to zero. Letting off a month that's already
shared out hands back each person's net for that month the same way.
Corrections count in "this month so far", and are settled when the month
closes.

## Undo

Each reset is one History row (`house_actions.kind = 'reset'`) holding every
row it changed, as it was. Undo puts them back, for an admin, until the month
it touched (and the month its corrections went in) is shared out, and only
while nobody has ticked or flagged any of it since. A re-deal's undo brings
the old deal back.

## Telling people

Everyone a reset touches, except the admin, gets a push ("Glyn reset your
week") and the Wall says what happened. Undoing someone else's reset posts
"Sam undid Glyn's reset."

## Streaks and tokens

Streaks are counted again from the closed weeks after any reset or its undo
(`recount_streaks`), as the clock counts them. Tokens already earned stay
earned.

## Where it lives

- `supabase/migrations/20261101100000_admin_resets.sql`: `admin_reset` (the
  preview and the change, service role), `undo_reset`, `reset_reach`,
  `add_correction`, `recount_streaks`, `hand_over`, and the skipped week in
  `house_balances`.
- `apps/api/lib/moves/resets.ts`: who may ask, what forfeits cost (rules and
  House Pass), the re-deal, the pushes. `POST /api/resets` and Ask Jonz's
  tools share it.
- `packages/core/src/resets.ts`: the request and preview, and the sheet's
  words (`resetSheet`).
