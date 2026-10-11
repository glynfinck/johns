-- ---------------------------------------------------------------------------
-- The database keeps the clock.
--
-- Every ten minutes pg_cron asks the app to run its tick
-- (app/api/cron/tick/route.ts): deal new weeks, settle outcomes and
-- forfeits, decide disputes, close weeks and months, send reminders. The
-- rules live in TypeScript (lib/engine) where they are unit-tested; this is
-- only the alarm. It means a missed Johh is fined at the end of the week even
-- if nobody opens the app that night, on any Vercel plan.
--
-- The URL and the shared secret come from Vault, so this migration carries no
-- environment. Until both secrets exist the job does nothing, which is what
-- local development wants: there, `npm run tick` or simply opening the app
-- (lib/engine/fresh.ts) does the same work. See DEPLOYMENT.md for the two
-- `vault.create_secret` calls a hosted project needs.
-- ---------------------------------------------------------------------------

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create function public.request_tick()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  url text;
  secret text;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'johhs_tick_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'johhs_tick_secret';
  if url is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke execute on function public.request_tick() from public, anon, authenticated;

select cron.schedule('johhs-tick', '*/10 * * * *', 'select public.request_tick()');
