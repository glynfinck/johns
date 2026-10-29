-- Notifications you can answer, and say when to send.
--
-- notification_prefs: one row per person, the same on every device. Each kind
-- of push (@app/core notify.ts, PUSH_KINDS) is on or off, and quiet hours
-- hold reminders until they end and send anything else without a sound. No
-- row means everything on and no quiet hours, so nobody needs one to start.
--
-- push_action: a button on a notification ("Done", "It was done", "It
-- wasn't"). The phone or browser that shows the notification has no session
-- to hand, so apps/api checks the signed token that came with the push and
-- then calls this as the service role. It makes the move as that person, by
-- setting the caller for this transaction only, through the same function
-- the app calls (mark_done, cast_vote), so the rules live in one place.

-- --- Settings ------------------------------------------------------------------------

create table public.notification_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade default auth.uid(),
  reminders boolean not null default true,
  checks boolean not null default true,
  flags boolean not null default true,
  deal boolean not null default true,
  quiet_from smallint check (quiet_from between 0 and 23),
  quiet_until smallint check (quiet_until between 0 and 23),
  -- The zone quiet hours are in: the device's when they were saved.
  timezone text check (timezone is null or length(timezone) between 1 and 64),
  updated_at timestamptz not null default now(),
  check ((quiet_from is null) = (quiet_until is null)),
  check (quiet_from is null or quiet_from <> quiet_until)
);

alter table public.notification_prefs enable row level security;
create policy "your own settings" on public.notification_prefs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "save your settings" on public.notification_prefs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "change your settings" on public.notification_prefs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.notification_prefs from anon, authenticated;
grant select on public.notification_prefs to authenticated;
-- user_id in update too, so that saving is one upsert; the policy keeps it yours.
grant insert (user_id, reminders, checks, flags, deal, quiet_from, quiet_until, timezone, updated_at),
  update (user_id, reminders, checks, flags, deal, quiet_from, quiet_until, timezone, updated_at)
  on public.notification_prefs to authenticated;
grant select, insert, update, delete on public.notification_prefs to service_role;

-- --- Buttons on a notification ---------------------------------------------------------------

-- Exactly one of p_assignment (tick it) or p_dispute with p_uphold (vote).
create function public.push_action(p_user uuid, p_assignment uuid, p_dispute uuid, p_uphold boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if p_user is null or (p_assignment is null) = (p_dispute is null)
     or (p_dispute is not null and p_uphold is null) then
    raise exception 'push_action' using errcode = '22023';
  end if;
  -- auth.uid() reads these; is_local, so they end with this call.
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  if p_assignment is not null then
    perform public.mark_done(p_assignment, null);
  else
    perform public.cast_vote(p_dispute, p_uphold);
  end if;
end;
$$;

revoke execute on function public.push_action(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.push_action(uuid, uuid, uuid, boolean) to service_role;
