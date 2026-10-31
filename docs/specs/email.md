# Email

## What it does

Jonz sends email from `hello@jonz.app` through Resend: the "account deleted"
email now, and in later steps the sign-in emails (sign-up code, password
reset), an owner's notices, and replies from the `support@jonz.app` inbox.
Every email has the same look, and a reply lands in the support inbox.

Design page with every email and the options that were weighed:
https://claude.ai/artifact/85XFzmVpq1J99RY2YdxA4C. Glyn picked look B,
"Notice", and Panel for notices (31 October 2026).

## The look

- **B, Notice.** White, a small JONZ sign (`sign.png`) with jonz.app at the
  right, a 3px ink rule, then a headline in black caps (Overpass where the
  mail app loads it, Arial Black where it doesn't) and one bold sentence.
  Plain words in Arial under it, one amber button with an ink edge, and the
  foot: why this person got it, an opt-out where there is one, the tagline.
- **Panel, for a notice from the owner.** Same top, but the headline is a
  block in the notice's banner colours (`notice-banner.tsx`): status on the
  night card with hazard tape above and below and the warning triangle in
  hazard; offer on amber with an ink border and the gift; news on the card
  colour with a hairline and the newspaper. The icon sits on a square tile.
  The title and words are the notice's own, so the app and the inbox match.
- Dark mode where the mail app follows the phone (Apple Mail, Outlook):
  wet-tarmac paper, light ink, the news panel on the night card with a light
  icon. Gmail makes its own guess; every part still reads.
- Voice as the brand guide says: no emoji, no exclamation marks, the rule
  stated plainly.

## Inputs and outputs

- `@app/core` `email.ts`: `renderEmail(spec)` draws a subject, preheader,
  HTML and plain text from blocks (text, small print, button, code, rows) and
  an optional panel. Every word is escaped and every link must be https (or a
  Supabase template placeholder). `accountDeletedEmail` and `noticeEmail`
  are the first two emails.
- `apps/api/lib/email.ts`: `sendEmail(to, message, { tag, idempotencyKey })`
  posts to Resend. With no `RESEND_API_KEY` it logs and sends nothing.
  Resend's refusals come back as `{ sent: false }`, never thrown: the caller
  decides whether a failed email should fail what it was part of (deleting an
  account must not).
- `npm run email:preview` writes every email to `email-previews/` (with
  `--shots`, phone-width pictures in light and dark).

## Edge cases

- A name is optional: "Hi," without one.
- An offer or news email always has a "Stop offers and news" link; a status
  never does.
- The delete email goes to the address the account had, after the delete
  finishes, with an idempotency key so a retry sends once.

## Platforms

Email only. The pictures are PNGs on jonz.app, because mail apps don't load
SVG or our font reliably.

## Done when

- [x] The look and the first two emails, with tests and previews.
- [ ] Glyn's Resend account, the jonz.app records, `RESEND_API_KEY` on jonz-api.
- [x] The delete-account flow sends `accountDeletedEmail` (`lib/account/deletions.ts`).
- [ ] Supabase's sign-in emails through Resend, in this look; email and password sign-in.
- [ ] The support@jonz.app inbox, and Privacy and Terms pointing at it.
- [ ] Notices: "Also email it" on the owner's Notices page.
