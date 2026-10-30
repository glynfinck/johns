# Settling up in Splitwise

## What it does

A house that already keeps its shared money in Splitwise can say so in House
rules (Money › Settle up: In Jonz or In Splitwise). At month end Jonz still
works out who owes whom; then, instead of waiting for the money, whoever is
owed adds it in Splitwise and taps "Added to Splitwise", and Jonz stops
asking for it.

Jonz never talks to Splitwise. Its API is "not intended for commercial use"
and "may not be used in connection with any fee-based service" without a
licence from Splitwise (dev.splitwise.com), and Jonz sells the House Pass.
So the person copies the amount across; posting it for them would need that
licence and each housemate's Splitwise sign-in.

## Inputs and outputs

- `houses.settle_in`: `'jonz'` (the default) or `'splitwise'`, an admin's
  setting like the rest of the rules (`HouseSettings.settleIn`).
- House's month card, in a Splitwise house:
  - Owed to you: "Tom owes you £4.01 for September", meta "Add it in
    Splitwise: paid by you, Tom owes all of it"; the expense's description
    ("Jonz Stake, September") with Copy 4.01 (the bare amount, which is what
    Splitwise's amount box takes); then "Added to Splitwise" in place of
    "Mark received" (amber on the first, as before).
  - What you owe: meta "Priya adds it to Splitwise", nothing to press.
  - Open Splitwise under the rows, to secure.splitwise.com (the Splitwise
    app takes the link over where it's installed).
- "Added to Splitwise" is `confirm_payment(p_house, p_from, p_amount,
  p_via => 'splitwise')`: the same payment in the ledger as money received
  (so balances, undo and Stake history need nothing new), with `via` in the
  `paid` event's data. The Wall says "Priya put Tom's £4.01 into Splitwise."

## Edge cases

- Only the person owed can mark it, as with money received; never more than
  is owed (`more_than_owed`), and `p_via` is null or `'splitwise'`
  (`bad_payment` otherwise).
- Someone who has left: no button, as before ("They've left, so it can't be
  marked here").
- Switching back to In Jonz: rows go back to Mark received. What was already
  marked stays marked.
- Undo after "Added to Splitwise" takes the payment back like any other.

## Platforms

The same on iOS, Android and web. Copy uses expo-clipboard
(`navigator.clipboard` on the web).

## Done when

- [ ] An admin can set Settle up to In Splitwise, and everyone sees it in the rules.
- [ ] Owed money shows its Splitwise line, Copy puts the amount on the clipboard, Open Splitwise opens it.
- [ ] Added to Splitwise clears the debt for both people and the Wall says so.
