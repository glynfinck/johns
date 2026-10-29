# Describe your house

## What it does

An admin setting up a house chats with Jonz about it, as in other apps'
assistants. Jonz greets them and asks about the house; they answer in
words ("Four of us, two bathrooms, Sam and Priya share the upstairs one")
and Jonz drafts the John list: each John's kind, effort points, how often,
its due day and time, whether it's on call, and the groups that share some
of them. Jonz drafts as soon as it can and asks at most a couple of
questions, one at a time, each with quick answers to tap or a day picker.
Every later message changes the draft ("oven every month").

The draft shows in the chat as a card made of the app's own parts: the
setup checklist's rows (every John ticked), "See all" opening it into the
whole list with its groups, and the amber button that adds the ticked
Johns. Quick answers are the app's outline buttons and the day picker is
its Segmented, so the chat looks like the rest of Jonz. Nothing is added
until the admin presses Add; after that the chat shows how many were added
and opens the list. Starter lists (flat share, couple, family) sit under
the greeting for anyone who'd rather not write, and stand in whenever
Claude can't be reached. It's free for every house.

Later, not in this change: the same chat under House for changes ("Sam's
moving out"), shown as a before-and-after card that an admin applies, with
any change that shifts fair shares naming who it affects. That part is
meant for the House Pass.

## Inputs and outputs

- `POST /api/setup/draft` `{ houseId, messages, draft }` (`ChatRequest`):
  the chat so far (at most 24 messages of up to 800 characters, ending with
  the admin's) and the draft as it stands, or null. It answers
  `{ reply, ask, draft, source }` (`ChatResponse`): Jonz's words; `ask`,
  null or a question to tap an answer to (`choices`, up to 5 quick answers,
  or `day`); `draft`, the whole new draft or null when this turn left it as
  it was; `source`, `"ai"` from Claude or `"starter"` when a starter list
  stood in. A draft is `{ johns, groups, note }` (`HouseDraft`): each John
  as the list holds it plus `group` and `why`; each group with `memberIds`
  (housemates already in the house) and `waitingFor` (names nobody goes by
  yet); `note`, what the draft assumed.
- Only an admin of the house may ask (403 otherwise). A house gets
  `CHAT_TURNS_PER_DAY` (30) turns from Claude in any 24 hours (409
  `draft_limit` after that); starter lists are unlimited.
- Claude is `anthropic/claude-haiku-5.5` through Vercel's AI Gateway (OIDC
  on Vercel, no key), with structured outputs (`apps/api/lib/ai/house-draft.ts`).
  The current draft goes back to Claude in words (`draftForModel`: "me",
  first names, on call). Core's `tidyDraft` and `tidyAsk` check every value
  afterwards: names cut to fit, numbers put in range, unknown kinds made
  Other, duplicates dropped, group members matched to housemates by name,
  at most 30 Johns and 6 groups. Effort follows the John list's existing
  scale (points 1 to 10).
- Each turn asked of Claude is a `house_drafts` row (outcome, how many
  Johns drafted, tokens), readable only by the service role. The chat is
  never stored.
- Keeping makes the groups the kept Johns need through `save_group`, then
  adds the Johns in one insert through the admins' column grants
  (`keepDraft`, `addJohns` in `apps/client/src/api`). A drafted group with
  nobody in the house yet can't be made, so its Johns go to everyone until
  the admin makes it by hand. A group the house already has with that name
  is used as it is.

## Edge cases

- No AI Gateway (locally and in CI), or Claude erroring, refusing or being
  cut off: `offlineTurn` answers. Before there's a draft it gives the
  starter list the admin named, or the one `guessStarter` picks from what
  they wrote, and says so; once there's a draft it leaves it as it is and
  says the change didn't go through. The app falls back to `offlineTurn`
  too if the API can't be reached at all, so setup never stops here.
- A message that isn't about the house: Claude answers in words and the
  draft stays as it was.
- A refusal (the daily limit): the message goes back in the box, with the
  reason above it.
- Two housemates with the same first name: a drafted group naming that
  first name waits for them rather than guessing.
- Time away isn't drafted: only each housemate can book their own.

## Platforms

The same on iOS, Android and web: a page in House's stack
(`/house/describe`), opened from Today's setup card while the list is empty
and from the empty John list. The message box stays above the keyboard.

## Done when

- [x] An admin with an empty list can chat about the house, answer by
  tapping, open the draft, untick Johns and add the rest.
- [x] Starter lists work with no gateway, and when Claude fails.
- [x] Housemates who aren't admins are refused; a house is held to 30
  turns a day.
- [ ] On production, a real chat drafts a sensible list through the AI
  Gateway.
