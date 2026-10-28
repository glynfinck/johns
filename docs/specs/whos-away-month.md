# Who's away, on the month

Time away's "Who's away" was a strip of squares, one row per housemate over
the next four weeks. It becomes a month calendar where each day is shaded by
how many people are away, and tapping a day opens a sheet that says who.
Glyn picked option F from the mockups on 28 October 2026
(https://claude.ai/artifact/FLA1YnQJ4trHmMEqDBHtNP): C's shaded days, plus a
sheet that opens when you tap one.

## What it does

- **Who's away** shows one month at a time. Weeks start on the house's first
  day, and the days of the months either side fill the first and last week.
  It opens on this month. Earlier month goes back no further than this month,
  because only the last week of time away is read. Later month has no limit.
- Each day is shaded by how many are away: none, one (ink at 12%), two (ink
  at 30%), or three or more (solid ink, with the words in the card colour).
  The count sits under the date and today's date is ringed. A key under the
  calendar shows the three shades. Days from other months, and days already
  gone, use the lighter weight, as the booking calendar does.
- Under the key: "Tap a day to see who's away and who's home.", or "Nobody's
  booked any time away." when no trips are coming up.
- Tapping a day opens a sheet titled with the day ("Sunday 8 November") and
  "3 away · 2 home". **Away** lists each trip that covers the day, the one
  that began first first: the avatar, the first name (You for yours, "A
  former housemate" for someone who has left), then "Back Tue 10 Nov" and
  the note. **Home** lists everyone else. Day before and Day after step
  through the days without closing the sheet, and the calendar follows to
  the day's month.
- The per-housemate trip rows under the old strip are gone, because the
  day's sheet says the same thing. Your own trips still have their own
  section above, where you cancel them or say you're back.

## Inputs and outputs

No new reads or writes: the same `loadAway` periods (from a week ago on).
Core adds `monthWeeks(month, weekStarts)`, `tripsOn(periods, date)` and
`backOn(period)`, and the words in `AWAY_COPY`.

## Edge cases

- Nobody away on a day: "Nobody. Everyone's home."
- Everyone away: "Nobody. Everyone's away." under Home.
- A trip that runs into the next month shades both months' days.
- A month of four, five or six weeks (a February that starts on the
  house's first day takes four).

## Platforms

The same on iOS, Android and web. From WIDE the sheet is a dialog in the
middle of the page, as every sheet is.

## Done when

- [x] The month shows each day's count, today ringed, on all three.
- [x] Tapping a day opens its sheet, and Day before and Day after walk it.
- [x] Screen readers hear each day as "Sunday 8 November, 3 away".
