# Focus: three places instead of six

The Expo app's redesign, chosen from the UI review of 25 October 2026 (the
review canvas has the findings and the mockups this follows). Johns drew the
same four people and the same Johns six ways, across six equal tabs, and made
every view loud. Focus gives each of the app's three jobs one home and one
row component, and keeps Bin Night for the moments that count.

## What it does

- **Today** is for doing: your next John with the screen's one amber button,
  anything that needs your vote, the rest of your week as rows, and one line
  on where you stand.
- **Week** is for seeing: how the whole house's week is going, one group per
  housemate, finished Johns folded away.
- **House** is the group page, in this order: the month's money and
  settling up, the Table (points and money on one row per housemate), the
  latest of the Wall, the house's setup, and you.
- Every John action (tick, photo, undo, immunity, swap, dispute, vote) lives
  in one **John sheet**, opened by tapping any John anywhere. Every setting
  has its own page, and every housemate has a page.
- Nothing the app does today is removed: it moves to where it acts, at most
  one tap down.

## Inputs and outputs

No new API, table or SQL function: every read and move is one that exists.
The screens change; `@app/core` gains the words and the pure helpers that
shape what they show (each with Vitest tests).

### Navigation

| Where | What |
| --- | --- |
| `/today` (tab) | Next up, Needs you, The rest of your week, the standing line |
| `/week` (tab) | The summary bar, one group per person, the fair-share footer, the `•••` menu |
| `/house` (tab) | The month card, the Table, the Wall's latest, House setup, You, Leave |
| `/house/stake` | Stake history: the ledger by month, Mine or Whole house |
| `/house/wall` | The whole Wall, by day, with older events on request |
| `/house/people/[userId]` | A housemate's page (and the admin's Make admin and Remove) |
| `/house/johns`, `/house/rules`, `/house/away`, `/house/groups` | House setup, one page each, with the editors that exist |
| `/wall`, `/stake`, `/table` | Old links: redirect to `/house/wall`, `/house/stake` and `/house` |

Tabs along the bottom of a phone, a left rail of the same three from `WIDE`
on the web. Pages pushed from House keep the tabs. Depth is two levels:
tab, then a pushed page or a sheet; a sheet changes its own content rather
than opening a second sheet. The Today tab carries a badge counting what
waits for your vote.

### Visual rules (all screens)

- **Type**: six roles in `theme.ts`, never inline sizes. Title 28/32 Black
  caps (once per screen, in the 52pt title bar); Lead 22/28 Bold, sentence
  case (at most once per screen); SectionLabel 12 ExtraBold caps, tracking 1,
  muted; RowTitle 17 Bold; Body 16 Regular; Meta 14 Regular, muted. Tab
  labels 12 Bold, sentence case. Nothing smaller than 12, numbers in tabular
  figures. Caps only for the Title, section labels and chips.
- **Hi-vis amber** has two jobs: the fill of at most one primary button per
  screen, and the 3pt marker on the current tab. Never text, a border, a
  bar, a chip or an avatar. Your avatar is an ink plate with light initials.
- **Hazard** only for overdue, missed, late and disputed, and for money lost
  or owed, always with an icon and a word. Destructive rows (Leave, Remove)
  use it as text. **Green** only for the done tick and a positive headline
  figure. Floors' lid moves to teal (`#0f7c7a`, dark `#4fbdb9`) in both apps,
  so a category never shares a status's hue.
- **One status map** in core (`STATUS_MARK`) for Today, Week, the John sheet
  and the Wall: upcoming shows no chip; due soon an outline chip with a
  clock; checking an outline chip with a tick; done a green tick; late a
  hazard clock and "Late"; overdue a hazard triangle; missed a hazard X;
  disputed a hazard flag; excused a quiet shield.
- **Motifs**: a lid colour appears only as a 10pt dot before the category in
  a meta line. Inside the house, hazard tape is only a 4pt left edge on an
  overdue or missed John. The full tape, the boxed wordmark and big caps stay
  for the front door, sign-in, the join page and the invite sheet.
- **Surfaces**: the pavement page and one inset group per section (card
  colour, radius 10, no border, hairlines that start at the text). At most
  one stand-alone card per screen (Today's Next up, House's month card). A
  card never holds a card or a tinted panel.
- **Rows**: one `Row` everywhere: a 32pt leading slot (tick circle, avatar or
  icon), a one-line title, one meta line, one trailing item (a value, a chip
  or a text button), 56 to 64pt tall with 48pt targets. 16pt gutter plus 16pt
  inset; 8 from a section label to its group, 32 between sections.
- **Chrome**: no wordmark strip inside the house. One 52pt title bar per
  screen, the same on every tab: the page's name on the left and, on the
  right, the sparkles that open Jonz (admins) always at the edge with the
  screen's own `•••` just inside them. What a tab says about itself (Today's
  date, House's housemates) is the page's first line, under the bar, as
  Week's range line already is. Pushed pages put "‹ House" above the title. Content capped at 680pt on every tab.

### Today

1. Title bar: TODAY. The date is the page's first line, under it.
2. **Next up** (the one card): your next open John as the Lead, a meta line
   (lid dot, category, due time, what lateness costs: "£1 if late"), amber
   "Mark done" with an outline "Photo" beside it (a photo John leads with
   "Take a photo"), and "Skip with immunity or swap ›" only while you hold a
   token. Tapping the name opens the John sheet. Overdue: the 4pt hazard
   edge and "Overdue since Tue · £1 now, £3 if missed".
   Other states replace the card, never stack above it: all done ("You're
   clear until Tue", the next John, no amber); away ("You're away until Fri
   30 Oct", how catching up works, "Change dates ›"); not dealt (an admin's
   setup checklist: Add your Johns, Invite housemates, Deal week 1, the last
   amber once the first two have something; everyone else "Sam will deal it
   soon").
3. **Needs you · n**: one row per dispute waiting for your vote, opening the
   John sheet's vote; hidden when empty.
4. **The rest of your week**: your other Johns as rows with a 48pt tick
   circle; Undo while a tick is being checked; finished Johns folded into
   "Done (n)".
5. One tappable line: "Joint 2nd this week · up £4.01 in October ›" to House.

### The John sheet

Meta (lid dot, category, points, how often), the John as the Lead, when it is
due and what it costs. Then, by whose it is and where it has got to:

- **Yours, open**: amber "Mark done", outline "Add a photo and mark done"
  (a photo John: "Take a photo" and "From your library"). Under "If you
  can't": "Skip with immunity" (turns into the sentence it means, with "Skip
  it" and "Cancel") and "Swap this John" (the sheet's content becomes the
  housemates' open Johns, then "Swap them"), each only with the token.
- **Yours, being checked**: when it stands, and "Undo".
- **A housemate's fresh tick**: who ticked it and when it stands, and an
  outline "Dispute" that opens "What's wrong with it" and "Put it to the
  house" in place.
- **A dispute**: the reason in body ink, the tally ("1 fine · 1 not done ·
  closes in 17h"), and two equal outline buttons in the tally's order, "It's
  fine" and "Not done" (your vote shows chosen). Voting closes the sheet with
  "Vote counted. You can change it on Week."
- **Settled**: what happened, and the photo if there is one.

### Week

Title bar: THIS WEEK and `•••` (I'm away… to Time away; for admins, Edit the
John list, and Re-deal this week while nothing is ticked, with a confirm).
The summary on the page: the range and when the week ends, then an 8pt bar
whose parts add up to the week's Johns (done, checking, disputed, overdue,
to go) and a legend whose parts filter the list. One group per person, you
first: avatar, name, "1 of 3 done · 6 pts", "away 29 Oct–1 Nov", a "swap
ready" tag on yours; open Johns as rows, finished ones folded with late
counts in hazard. Tapping any row opens the John sheet. Footer: the deal's
fairness in one sentence. Not dealt: one empty state, with the admin's amber
"Deal this week". From `WIDE`, one table row per John, the John column
flexible and the action in the status cell.

### House

Title bar: the house's name. "4 housemates · £20 a month each" is the page's
first line, under the bar.

1. **The month card**: your net so far as the Lead ("You're up £4.01", the
   figure green only when positive), what you've forfeited and when it's
   shared out; each settle-up between you and a housemate as a row ("Tom owes
   you £1.34" with the page's one amber "Mark £1.34 received"; "You owe Priya
   £1.34 · waiting for Priya to confirm"), none when square; "Stake history
   ›".
2. **The Table**, with a Week | month switch: one row per housemate, sorted
   by points, with streak, tokens, time away or late and missed (in hazard)
   in the meta line and the month's money trailing with its sign. Your row
   has a neutral tint. Then "+ Invite housemates" (the invite sheet: the code
   large, amber "Share invite", "Copy link") and "How points and the stake
   work ›" (a sheet of the rules in plain words). A row opens that
   housemate's page: their week and month, fair share, streak and tokens, the
   month's money (forfeited, share, net), time away, and for admins "Make
   admin" and "Remove Tom from the house".
3. **The Wall**: the latest four events as rows, one sentence with first
   names, the time trailing; a housemate's tick has a "Nice one" toggle, and
   a long press shows all four reactions with their labels. "See all" opens
   the whole Wall, by day, with repeats folded, photos, and "Load older".
   A payment's amount shows only to the two people in it.
4. **House setup** ("affects everyone"): Johns (count, points a week), Rules
   (stake, late, missed), Time away (who's away next), Groups (for admins, or
   once one exists), each opening its page with the editors that exist.
   Everyone reads the rules as plain rows; admins get Edit.
5. **You**: Name, Reminders (its value; the sheet holds today's on/off),
   Look (Day | Night | Auto in the row), Sign out.
6. On its own at the bottom, "Leave 29 Albert Road" in hazard text, whose
   confirm says what it costs. Footer: "Johns never moves money. Privacy ›".

### Before you have a house

The front door keeps the wordmark and the hazard-tape hero, with three plain
sentences in place of the feature cards, amber "Start a house" and outline
"I've got an invite"; the choice survives sign-in. "Start a house" is one
field, "Name your house", with the defaults in one line and "Change" for the
rest. Welcome is the fallback, with one "Paste your invite link or code"
field. Privacy gets headed sections and Back.

## Edge cases

- A house of one: Needs you never shows; the Table is one row; Invite
  housemates is the next step on Today's setup checklist and on House.
- Nothing dealt, ever: Today's checklist for admins, a sentence for others;
  Week is one empty state; House still shows setup.
- Every John done: Today says when you're next needed, with no amber.
- No tokens: no "Skip with immunity or swap" line and no "If you can't"
  group. Swap with nobody else's open John: the swap row isn't offered.
- Away all week: the away card replaces Next up; Johns pulled forward before
  you leave say so in their meta line.
- Money: square months draw no settle-up rows; amounts are integer minor
  units through `formatMoney`/`formatSigned`; several people owing you each
  get a row, with only the first one's button amber.
- A former housemate on the Wall or in the ledger: "A former housemate".
- Long names and long John names truncate to one line in rows; the John
  sheet shows them in full.
- A refusal from the database is a sentence where the move was made (in the
  sheet, the row or the page), never a crash.
- Offline or a failed read: the page says so with "Try again", as now.
- Light and dark both follow the same rules with their own tokens.

## Platforms

- Shared code on all three. On the web, a long press works with the mouse
  held down; reactions are also reachable by keyboard from the row.
- From `WIDE` on the web: a left rail with the same three destinations and
  labels, content capped at 680pt, and Week as a table.
- `apps/api`'s own pages keep their look until Phase 14 removes them; only
  the shared floors colour changes there.

## Later (not in this build)

- An invite preview before sign-in (the house and its stake): today a join
  link names the house only to someone signed in, and showing it to anyone
  with the code needs a new public function.
- Reminder choices beyond on and off (only my Johns, a time): needs the
  server to send them.
- Rules presets (Chill, Standard, Strict).
- Ideas the review's judges liked from the other directions: a "Needs
  attention" group on Week, money to confirm counted in Today's badge, a
  one-line Wall peek on Today, a month-end results moment.

## Done when

- [x] The house has three tabs (Today, Week, House) on a phone and a
      three-item rail from `WIDE`; `/wall`, `/stake` and `/table` redirect.
- [x] Today fits one phone screen in the seeded house: Next up, Needs you,
      the rest of your week, the standing line.
- [ ] Every John action works from the John sheet on Today, Week and House.
- [x] Week shows a summary that adds up, one group per person and folds.
- [x] House shows the month and settle-up, the Table with Week | month, the
      Wall's latest and See all, setup rows and You, and Leave at the bottom.
- [x] Each housemate has a page; admins can make admin and remove there.
- [x] Each setup page opens its existing editor; non-admins read the rules.
- [x] Only one amber button per screen; no inline font sizes or colours.
- [ ] `npm run typecheck && npm run lint && npm test` and the client e2e pass.
- [ ] Checked on the web build at phone and laptop widths, light and dark;
      iOS and Android checks wait with the device checks (Phase 12).
