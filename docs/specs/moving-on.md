# Bring Jonz to your next house

Item 1 of the growth spec. Every lease that ends sends three or four people
into new houses, each of whom already knows Jonz. The goal is for one in four
people who move out to start Jonz again in their new place.

## What it does

- **A moving-out date.** House, You, Moving out picks the day from the same
  calendar as time away (today or later, within a year), and "I'm staying
  after all" clears it. The Wall says "Sam moves out on Tue 30 Jun". From
  that day the deal gives them nothing (they're away for good from it; a week
  that starts on or after it leaves them out altogether, shares included).
  Johns already dealt to them stay theirs, so an admin re-deals if the date
  lands in a week already dealt. Today says "You move out on Tue 30 Jun ›",
  and from the day itself "Moving day. Leave Flat 3 from House when you're
  ready ›", to the foot of House. Leaving stays where it was, with its cost
  and its hand-over.
- **Moving on.** Leaving lands on the welcome screen as before, which is now
  the Moving on screen while the house you left can come with you (90 days):
  "Start Jonz in my new place" (the one amber button) and, under "I have an
  invite", the invite field. Starting names the new place and copies every
  John on the old list as it stood: points, repeats, days, times, photo,
  on call, done together, keeps its day. Groups stay behind, since they name
  people who aren't coming. The new house is set up as any new house: tidy
  the list in Describe your house, invite, deal week 1.
- **One reminder.** Two weeks after leaving, if they haven't started or
  joined a house, one push: "Settled into your new place? Bring Jonz with
  you." Only one per move, never after 30 days; it answers to the reminders
  switch and waits out quiet hours.
- **For the people who stay.** While a housemate has a date, and for 30 days
  after the last one left (until someone moves in), Today asks "Someone
  moving in?" with "Send the invite", which opens the join card.
- **Measured.** Each move is a `moved_on` row: who, the house they left and
  when, and later the house they went to and how (`copied`, `started` or
  `joined`). Houses that came from a move are the rows with `how` set.

## Data

- `members.moving_out_on` (date), set only by `set_moving_out(p_on)`, which
  posts a `moving_out` event (`data.on`, null for staying after all).
- `moved_on` (RLS: your own rows, read only). `remove_member` writes one when
  you leave yourself (handing over included), or when an admin removes
  someone who had a date, and posts `moved_out` (`data.who`, the name, since
  the house can't look it up once they've gone). `create_house` and
  `join_house` fill in the newest open row (`record_moved_on`).
- `moving_on()`: the open move the Moving on screen offers (house, name,
  John count). `start_house_from(p_from, …)`: `create_house`, then the copy;
  refused (42501) for a house that isn't on your own open move.
- The engine: `stillHere` and `movingOutAway` (core `moving.ts`) in
  `dealWeek`; `remindMovers` after every house in `tickAll`.

## Edge cases

- The last one out: the house closes as before; they still get a move.
- Leaving again before moving on: the newest move is the one offered.
- An empty old list: the Moving on screen offers starting a house without
  promising Johns, and the new-house screen is the plain one.
- Re-joining the house you left doesn't count as moving on.
- Someone removed by an admin without a date gets no move and no reminder.

## Platforms

The same on iOS, Android and web. The reminder is web push today and native
push once Phase 12 lands; there's no button on it.

## Done when

- [ ] Set, change and clear a moving-out date; the Wall says each.
- [ ] A week dealt after the date leaves the mover out; a week across it
      gives them nothing from the day.
- [ ] Leaving shows Moving on; starting copies the list; joining by invite
      works from it.
- [ ] The reminder arrives once, two weeks on, outside quiet hours.
- [ ] Housemates see "Someone moving in?" and can send the invite.
