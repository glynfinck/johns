# Any-length repeats

A John can come round on any period, not just every 1 to 4 weeks: monthly,
every few months, quarterly, twice a year, yearly or every few years. Asked
for on 29 October 2026, when Ask Jonz could only set the fridge deep clean to
every 4 weeks as the closest it got to quarterly. Glyn picked the sentence
editor (option B of the design page) the same day. Shared Johns ("Together",
with a roll call) are a separate change.

## What it does

- A John repeats either **in weeks** (every 1 to 26 weeks, counted from the
  week it was added, as before) or **in months** (every 1 to 60 months; a
  year is 12) on a weekday of the month: the first, second, third, fourth or
  last of its due day ("the first Saturday every 3 months").
- The **John editor** says when a John comes round as one sentence under a
  switch between **On a schedule** and **On call**:
  - "Every [3 months] from [November] on the [first] [Saturday] by [21:00]"
  - "Every [2 weeks] on [Sunday] by [21:00]"
  - "On call, up to [2 times] a week, done within [12 hours]"

  Each word in brackets opens its own choices in the sheet, in place of the
  form (a sheet never opens a second one), and **Done** goes back to the
  sentence. Under the sentence, **Next:** says the next four dates it lands
  on. How often has quick picks (every week, every 2 weeks, monthly, every 3
  months, twice a year, yearly) and a stepper with weeks, months or years for
  any other period. "From [month]" picks which of the first few months it
  starts in; a yearly John says "in [March]".
- The **deal stays weekly**. A John that repeats in months is dealt in the
  week that holds its date, to whoever the fair shares say, like any other.
- A **long John** (every 4 weeks or more, or any John in months) that is
  **missed** comes back into the next week's deal, so a missed quarterly job
  isn't lost for three months. It comes back once: its new assignment is the
  latest, so if that's done (or missed again, a week on) it doesn't repeat
  until its next date.
- **Week** has a **Coming up** section: the long Johns landing in the next
  four weeks, with their date and how often ("Sat 7 Nov · every 3 months").
  Nobody's name is on them until the deal hands each out in its week.
- Effort goes up to **20 points** (a whole day's job), on the list and on
  what is dealt.
- **Ask Jonz** drafts any period: quarterly is every 3 months, not every 4
  weeks.

## Fairness

- A long John's points count in full in the week it's dealt. Balances run
  over every week since each housemate joined, so whoever gets the big job
  is dealt less after it until it evens out.
- The list's "about N points a week" counts a John in months as its points
  × how many times a year it lands ÷ 52.

## Inputs and outputs

- `johns.every_months` (1 to 60), `week_of_month` (1 to 4, or 5 for the
  last) and `anchor_month` (a month it lands in, as year × 12 + month − 1).
  A John in months has all three and `every_weeks` 1; a John in weeks has
  none (`johns_monthly_check`). Migration
  `20261031090000_any_length_repeats.sql`, additive.
- `@app/core` `repeat.ts`: `landsInWeek`, `nextLandings`, `startMonths`,
  `repeatColumns` (what to write: a new John in months is anchored on the
  first month it lands in from next week; an edit keeps its anchor),
  `comesBack`, `comingUp`, and the words for each.
- `JohnDraft` takes `everyMonths`, `weekOfMonth` and `anchorMonth` (null for
  a John in weeks).

## Edge cases

- The last Saturday of a month is the fourth or the fifth; "last" always
  means the last. There's no "fifth", which some months don't have.
- Months across a year end and February in a leap year land on the right
  dates (`repeat.test.ts`).
- Changing how often or the day of a John in months keeps the month it
  counts from. Going back to weeks clears it; it counts weeks from the
  week it was added.
- An on-call John has no months: it's on call every week.
- A John switched to months while its date this month has passed starts in
  the next month it lands in.

## Platforms

The same on iOS, Android and web. On a laptop the editor sits in the panel
beside the list, and the sentence's choices open in the panel the same way.

## Done when

- [x] An admin can set a John to every 3 months on the first Saturday, and
      it's dealt only in those weeks.
- [x] A missed quarterly John is dealt again the next week.
- [x] Week shows it under Coming up in the four weeks before.
- [x] Ask Jonz sets quarterly as every 3 months.
