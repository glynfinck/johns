# Describe your house

## What it does

An admin setting up a house writes a sentence or two about it ("Four of us,
two bathrooms, Sam and Priya share the upstairs one, bins go out Tuesday
night") and Johns drafts the John list: each John's kind, effort points,
how often, its due day and time, whether it's on call, and the groups that
share some of them. The draft is only shown. Every John starts ticked; the
admin unticks any they don't want and adds the rest to the list, where each
one can be changed like any John added by hand. Starter lists (flat share,
couple, family) sit under the box for anyone who'd rather not write, and
stand in whenever Claude can't be reached. It's free for every house.

Later, not in this change: the same box under House for changes ("Sam's
moving out"), shown as a before-and-after list that an admin applies, with
any change that shifts fair shares naming who it affects. That part is
meant for the House Pass.

## Inputs and outputs

- `POST /api/setup/draft` `{ houseId, description }` (10 to 800
  characters) answers `{ draft, source }`: `source` is `"ai"` when Claude
  drafted it and `"starter"` when a starter list stood in. A draft is
  `{ johns, groups, note }` (`HouseDraft` in `@app/core`): each John as the
  list holds it plus `group` (a drafted group's name or null) and `why` (a
  few words, or ""); each group with `memberIds` (housemates already in the
  house) and `waitingFor` (names from the description nobody goes by yet);
  `note`, what the draft assumed.
- Only an admin of the house may ask (403 otherwise). A house gets
  `DRAFTS_PER_DAY` (10) drafts from Claude in any 24 hours (409
  `draft_limit` after that); starter lists are unlimited.
- Claude is `claude-haiku-5-5` with structured outputs, effort low, the
  fixed instructions cached (`apps/api/lib/ai/house-draft.ts`). Core's
  `tidyDraft` checks every value afterwards: names cut to fit, numbers put
  in range, unknown kinds made Other, duplicates dropped, group members
  matched to housemates by name ("me" is the asker), at most 30 Johns and 6
  groups. Effort follows the John list's existing scale (points 1 to 10: 1
  for the bins, 5 for a deep clean), which the fair-shares changes keep.
- Each draft asked of Claude is a `house_drafts` row (outcome, how many
  Johns, tokens), readable only by the service role. What the admin wrote is
  never stored.
- Keeping makes the groups the kept Johns need through `save_group`, then
  adds the Johns in one insert through the admins' column grants, their
  cadence counting from this week (`keepDraft`, `addJohns` in
  `apps/client/src/api`). A drafted group with nobody in the house yet
  can't be made (a group needs someone), so its Johns go to everyone until
  the admin makes it by hand. A group the house already has with that name
  is used as it is.

## Edge cases

- No `ANTHROPIC_API_KEY` in `apps/api`'s environment, Claude erroring,
  refusing, being cut off or drafting nothing: the answer is the starter
  list `guessStarter` picks from the description, and the screen says a
  starter list stood in. The app also falls back to one if the API can't be
  reached at all, so setup never stops here.
- A description that isn't about a house: Claude returns no Johns, and a
  starter list stands in.
- Two housemates with the same first name: a drafted group naming that
  first name waits for them rather than guessing.
- Time away isn't drafted: only each housemate can book their own, and it's
  dates rather than a pattern ("away most weekends").

## Platforms

The same on iOS, Android and web: a page in House's stack
(`/house/describe`), opened from Today's setup card while the list is empty
and from the empty John list.

## Done when

- [x] An admin with an empty list can describe the house, review the
  draft, untick Johns and add the rest.
- [x] Starter lists work with no key set, and when Claude fails.
- [x] Housemates who aren't admins are refused; a house is held to 10
  drafts a day.
- [ ] `ANTHROPIC_API_KEY` is set on the `johns` Vercel project (by hand,
  DEPLOYMENT.md) and a real description drafts a sensible list.
