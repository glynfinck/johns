# Deploying Johns

The same arrangement as Pub Golf: Vercel's git integration builds the app,
Supabase's GitHub integration applies the migrations, and CI only proves.
`main` is production; add a persistent `preview` branch project when the
house wants a staging copy.

Because the two integrations do not wait for each other, migrations must be
additive and readable by the code already deployed.

## One-time setup

### 1. Supabase project

1. Create a project (region near the house) and connect the GitHub repo
   under **Project Settings → Integrations → GitHub**, production branch
   `main`, so migrations in `supabase/migrations` apply on merge.
2. **Extensions:** `pg_cron` and `pg_net` are created by the migrations; if
   the project refuses, enable them under **Database → Extensions** and
   re-run the deploy.
3. **The clock.** In the SQL editor, store where the tick lives and its
   secret (the same value as the app's `CRON_SECRET`):

   ```sql
   select vault.create_secret('https://johns.glyn.dev/api/cron/tick', 'johns_tick_url');
   select vault.create_secret('<CRON_SECRET>', 'johns_tick_secret');
   ```

   Until both exist the cron job does nothing (pages still catch their own
   house up when opened). Check it with
   `select * from cron.job_run_details order by start_time desc limit 5;`.

### 2. Google sign-in

1. Google Cloud Console: an OAuth client (Web application). Authorised
   redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
2. Supabase **Authentication → Sign In / Providers → Google**: paste the
   client ID and secret. Leave email sign-up **off** in production: Johns is
   Google-only.
3. **Authentication → URL Configuration:** Site URL
   `https://johns.glyn.dev`; redirect URLs `https://johns.glyn.dev/**` and,
   for PR previews, `https://johns-*-<team>.vercel.app/**`.
4. Opening the app beyond your own house later means Google brand
   verification: the landing page at `/` already carries the name, the
   purpose and the privacy link it checks for.

### 3. Vercel project

Import the repo (framework: Next.js, install `npm ci`). Environment
variables for Production (and Preview, pointing at the preview project):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the project's anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | the service role key (server only) |
| `NEXT_PUBLIC_SITE_URL` | `https://johns.glyn.dev` |
| `CRON_SECRET` | a long random string, also in the Vault secret above |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | from `npm run vapid`, once per environment |
| `VAPID_SUBJECT` | `mailto:` an address you read |

The geo headers (`x-vercel-ip-country`, `x-vercel-ip-timezone`) that default a
new house's currency and time zone need nothing configured.

### 4. Domain

Add `johns.glyn.dev` to the Vercel project and a CNAME at the DNS host.

## Day to day

- Work on a branch, open a PR; CI must be green to merge.
- Merging to `main` deploys both halves. A migration that drops or renames
  anything the running code reads is an outage for the minute the deploys
  take; split it into an additive step and a later cleanup.
- `TICK_URL=https://johns.glyn.dev/api/cron/tick CRON_SECRET=… npm run tick`
  runs the clock by hand.
