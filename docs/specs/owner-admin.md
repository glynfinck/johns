# Owner admin

## What it does

The owner of Jonz (not a house admin) has pages of their own at `/admin`.
The first three are:

- **Notices**: a band at the top of the app for everyone. It can be an outage
  status, an offer, or news.
- **Deletions**: accounts waiting to be deleted (see "Deleting an account").
- **Audit log**: everything done on the admin pages, which nobody can change.

Later PRs add an overview, houses, messages, a support inbox
with an agent that asks before it acts, and an owner Ask Jonz. Designs are in
the owner admin viewer (https://claude.ai/artifact/97GEyJDGnrWxB8HTbbrXmo).

## Who gets in

- **The owner list.** `app_owners` is changed by migration only. Nobody can
  read or write it through the API, the service role included.
- **The owner check.** `is_owner()` is true only for someone in `app_owners`
  whose session has passed a second factor (`aal2`, a TOTP code from an
  authenticator app). Every owner read and write checks it in the database.
- **Anyone else.** They see the app's "Nothing here" page. The owner without a
  code this session sees the code screen. The first time, it adds the
  authenticator with a QR code or a typed key. The QR code is redrawn from
  Supabase's markup (`qrShape` in core); a db test checks that a real
  Supabase's code, drawn that way, scans back to the authenticator link. If
  it can't be drawn, the screen says to type the key instead of showing a gap.
- **Status for the page.** `owner_status()` returns `{owner, mfa}` so the page
  knows which of these to show. It says nothing to anyone else that they
  couldn't already tell.

## Notices

- **Saving and ending.** `save_notice` and `end_notice` are security-definer
  functions. They refuse with `42501` if the caller isn't the owner, and they
  write the audit entry in the same transaction.
- **Checks.** These run both in `@app/core` (`noticeProblems`, worded as
  sentences) and in the database:
  - the title is 1 to 80 letters;
  - the body is at most 240 letters;
  - the button is at most 30 letters, and its link is a page or an https URL;
  - the end comes after the start.
- **Reading.** Everyone, signed in or not, reads the notices that are on now.
  `GET /api/notices` reads them as anon with a 3 s timeout. When the database
  doesn't answer, it falls back to the copy in Vercel Global Config.
  `POST /api/notices/copy` (owner only) rewrites that copy after each save.
  Without `GLOBAL_CONFIG`, `EDGE_CONFIG_ID` and `VERCEL_API_TOKEN` there is no
  copy, and the owner is told the copy didn't update.
- **In the app.**
  - One band at a time: status first, then offers, then news (`noticeToShow`).
  - Closing an offer or news hides it for good. Closing a status hides it for
    24 hours.
  - The app keeps the last notices it read. If it can't reach Jonz it shows
    its own "can't reach Jonz" band.

## Deleting an account

Apple (5.1.1(v)) needs deleting to start in the app; Google Play needs a web
page for anyone who has removed the app. Both are the same form: House, then
Leave, then **Delete my account** (a sheet), and **jonz.app/delete**, which
signed out says what goes and stays and signs in on the way back to itself.

- **Asking.** Typing DELETE starts 30 days (`request_account_deletion`). The
  house sees you as away from today until the day it goes, around any time
  away you'd set; other devices are signed out. A House Pass you pay for
  stops renewing at the clock's next turn (the subscription it stopped is
  kept).
- **The 30 days.** Signing in shows only "Your account is being deleted",
  with the day, Keep my account and Sign out. Keeping it (`keep_account`)
  takes the time away back out, and the clock starts the Pass renewing
  again.
- **The owner.** Deletions lists who is waiting (name, email, house, days
  left). Delete now brings it forward to the clock's next turn; Stop is
  Keep my account for them; each takes a reason. For someone who emailed and
  can't sign in, the owner starts the same 30 days by their address.
- **The day.** The clock (`lib/account/deletions.ts`, every 10 minutes):
  `finish_account_deletion` takes them out of the house (the
  longest-standing housemate becomes admin if they were the only one; the
  last one out leaves the house empty, so closed), clears the Pass's buyer,
  their reminders and open swap asks, and renames them "Someone who left"
  without a photo. Then their photo files go, and their sign-in is
  soft-deleted: Supabase scrambles the email and unlinks Google or
  Microsoft, so the profile the house's history points at stays and
  signing in again makes a new, empty account. A Pass they carry from a
  house they left stops renewing. Last, the address they had gets "Your
  Jonz account is deleted" (`accountDeletedEmail`, docs/specs/email.md),
  by first name, with the day in their own zone (else their house's). The
  address and name are read before the delete takes them; a failed email is
  logged and never holds the delete up, and its idempotency key means a
  retry sends it once.
- **The log.** Request, keep, stop, delete now and done each write
  `admin_audit`, naming the account by id only, never a name or an email.

## The pages

- **On a laptop.** A rail down the left (232) has the wordmark, an Owner chip
  and the pages. What a phone opens on its own sits in the side panel: the
  notice editor, or the audit entry.
- **On a phone.** Tabs run along the bottom, as the house's do. The notice
  editor rises as a sheet, and an audit entry opens as its own page
  (`/admin/audit/[id]`).
- **Page actions.** The title bar holds only the title, the same on every
  page. An action sits next to what it changes.
- **Starting a notice.** Under what people see now, three tiles say what's
  happening: Something's wrong (an outage), An offer, and News. Each opens the
  editor with that kind chosen; Something's wrong also offers the ready-made
  outage words.
- **Long lists.**
  - Timelines (the audit log) load 50 older entries as you scroll. Each read
    starts from the last entry shown (keyset, not offset), so it stays fast.
    A Load older button does the same for a keyboard.
  - Lists of things (houses, people) come later, in pages of 50 with a count.

## Edge cases

- **No notices yet:** an empty state that says what a notice is for.
- **No audit entries yet:** an empty state that says every action is written
  down.
- **The copy didn't update:** the notice is saved anyway, and the toast says
  to save again to retry the copy.
- **The code expires with the session:** the next read is refused and the
  code screen shows again.

## Done when

- [ ] Only the owner, with their code, can open `/admin`, on iOS, Android and the web
- [ ] A status notice shows at the top of the app for everyone, and comes back a day after it's closed
- [ ] Every save and end is in the audit log, and the log can't be edited
