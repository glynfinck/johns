-- Delete my account (docs/specs/owner-admin.md, "Deleting an account").
--
-- Anyone can delete their account from the app (House, Leave) or at
-- jonz.app/delete. Nothing goes at once: the account waits 30 days, in which
-- signing in again and pressing Keep my account stops it. Meanwhile:
--
-- * their house sees them as away until the day it goes (time away from
--   today, around any they had set already), so nothing is dealt to them;
-- * a House Pass they pay for stops renewing (the clock tells Stripe, and
--   starts it again if they keep the account: apps/api lib/account);
-- * the owner sees them on the admin page's Deletions, and can make it
--   happen sooner when someone asks, or stop it.
--
-- When the day comes the clock finishes it (finish_account_deletion, then
-- the photo and the sign-in through the API): they leave the house, the
-- longest-standing housemate becomes admin if they were the only one, and
-- their name and photo go. What the house did together stays, as "Someone
-- who left": past Johns, the Stake ledger, the Wall. The sign-in is
-- soft-deleted (Supabase scrambles the email and unlinks Google or
-- Microsoft), so the profile row the house's history points at stays, and
-- signing in again later makes a new, empty account.
--
-- Every request, change of mind and final delete writes admin_audit. The
-- log keeps the account's id only, never a name or an email, so deleting an
-- account leaves nothing personal in a log nobody can change.

-- --- The wait --------------------------------------------------------------------------

alter table public.profiles add column deleted_at timestamptz;

create table public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  requested_at timestamptz not null default now(),
  -- When the clock deletes it; the owner can bring it forward.
  delete_after timestamptz not null,
  -- Asked for in the app ('self'), or by the owner for someone who emailed.
  requested_by text not null check (requested_by in ('self', 'owner')),
  state text not null default 'pending' check (state in ('pending', 'kept', 'done')),
  ended_at timestamptz,
  -- The time away it put in, to take back out if they keep the account.
  away_ids uuid[] not null default '{}',
  -- The House Pass subscription the clock stopped renewing (null when there
  -- was none, or it was stopping already), and when it stopped and restarted.
  pass_subscription text,
  pass_stopped_at timestamptz,
  pass_resumed_at timestamptz,
  check ((state = 'pending') = (ended_at is null))
);

create unique index account_deletions_one_pending on public.account_deletions (user_id) where state = 'pending';
create index account_deletions_due on public.account_deletions (delete_after) where state = 'pending';

-- Only these functions and the API's clock touch it; the owner reads it
-- through owner_deletions, and you read your own through
-- account_deletion_status. Nobody sees a Stripe id.
alter table public.account_deletions enable row level security;
revoke all on public.account_deletions from public, anon, authenticated;
grant select, insert, update on public.account_deletions to service_role;

-- A deleted account's sign-in photo never comes back: soft-deleting the
-- sign-in rewrites its identity, which would otherwise run this.
create or replace function public.follow_identity_photo()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  photo text := public.identity_photo(new.identity_data);
begin
  if photo is not null then
    update public.profiles
    set avatar_url = photo
    where id = new.user_id and avatar_url is distinct from photo and deleted_at is null;
  end if;
  return new;
end;
$$;

-- --- Time away for someone else --------------------------------------------------------

-- set_away, for any account: the owner starting a deletion puts the person
-- away, not themselves. Its body is set_away's as 20261102090000, with the
-- account passed in; set_away is now this for the signed-in account.
create function public.start_away(p_user uuid, p_starts date, p_ends date, p_note text)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := p_user;
  h public.houses;
  today date;
  away_id uuid;
  departure timestamptz;
  moved integer := 0;
  handed integer := 0;
  excused integer := 0;
  a public.assignments;
  sharers uuid[];
  holder uuid;
  soon boolean;
begin
  select houses.* into h
  from public.houses join public.members m on m.house_id = houses.id
  where m.user_id = me;
  if h.id is null then
    raise exception 'not_in_house' using errcode = '42501';
  end if;
  today := (now() at time zone h.timezone)::date;
  if p_starts is null or p_ends is null or p_starts < today then
    raise exception 'away_in_past';
  end if;
  if p_ends < p_starts then
    raise exception 'away_backwards';
  end if;
  if p_ends - p_starts > 91 then
    raise exception 'away_too_long';
  end if;
  if exists (
    select 1 from public.away
    where house_id = h.id and user_id = me and starts_on <= p_ends and ends_on >= p_starts
  ) then
    raise exception 'away_overlaps';
  end if;

  insert into public.away (house_id, user_id, starts_on, ends_on, note)
  values (h.id, me, p_starts, p_ends, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into away_id;

  departure := (p_starts::timestamp at time zone h.timezone) - interval '1 minute';
  soon := departure < now() + interval '12 hours';

  if not soon then
    update public.assignments x
    set due_moved_from = coalesce(x.due_moved_from, x.due_at), due_at = departure, reminded = 0
    where x.house_id = h.id and x.user_id = me
      and x.done_at is null and x.outcome is null and x.job_id is null
      and (x.due_at at time zone h.timezone)::date between p_starts and p_ends
      and x.due_at > departure;
    get diagnostics moved = row_count;
  end if;

  for a in
    select * from public.assignments x
    where x.house_id = h.id and x.user_id = me
      and x.done_at is null and x.absent_at is null and x.outcome is null and not x.excused
      and (x.due_at at time zone h.timezone)::date between p_starts and p_ends
      and x.due_at > now()
      and (soon or x.job_id is not null)
    order by x.due_at
    for update
  loop
    select coalesce(array_agg(gm.user_id), '{}') into sharers
    from public.johns j join public.group_members gm on gm.group_id = j.group_id and gm.house_id = j.house_id
    where j.id = a.john_id;
    if cardinality(sharers) = 0 then
      select array_agg(m.user_id) into sharers from public.members m where m.house_id = h.id;
    end if;

    select s.id into holder
    from unnest(sharers) as s (id)
    where s.id <> me
      and not exists (
        select 1 from public.away w
        where w.house_id = h.id and w.user_id = s.id
          and (a.due_at at time zone h.timezone)::date between w.starts_on and w.ends_on
      )
      and not (a.job_id is not null and exists (
        select 1 from public.assignments y where y.job_id = a.job_id and y.user_id = s.id
      ))
    order by (
      select coalesce(sum(x.points), 0) from public.assignments x where x.week_id = a.week_id and x.user_id = s.id
    ), s.id
    limit 1;

    if holder is null then
      update public.assignments set excused = true where id = a.id;
      excused := excused + 1;
    else
      update public.assignments set user_id = holder, reminded = 0 where id = a.id;
      handed := handed + 1;
    end if;
  end loop;
  moved := moved + handed + excused;

  insert into public.events (house_id, kind, user_id, data)
  values (h.id, 'away', me, jsonb_build_object(
    'away', away_id, 'starts_on', p_starts, 'ends_on', p_ends, 'moved', moved,
    'handed', handed, 'excused', excused));
  return moved;
end;
$$;

create or replace function public.set_away(p_starts date, p_ends date, p_note text default null)
returns integer
language plpgsql
security definer set search_path = ''
as $$
begin
  return public.start_away(public.require_user(), p_starts, p_ends, p_note);
end;
$$;

-- Away from today until the day the account goes, around any time away
-- already set: each gap is its own time away, as if set in the app. Says
-- which it made. Nothing for someone in no house.
create function public.deletion_away(p_user uuid, p_until timestamptz)
returns uuid[]
language plpgsql
security definer set search_path = ''
as $$
declare
  h public.houses;
  last_day date;
  free_from date;
  w public.away;
  made uuid[] := '{}';
begin
  select houses.* into h
  from public.houses join public.members m on m.house_id = houses.id
  where m.user_id = p_user;
  if h.id is null then
    return made;
  end if;
  free_from := (now() at time zone h.timezone)::date;
  last_day := (p_until at time zone h.timezone)::date;
  for w in
    select * from public.away
    where house_id = h.id and user_id = p_user and ends_on >= free_from and starts_on <= last_day
    order by starts_on
  loop
    if w.starts_on > free_from then
      perform public.start_away(p_user, free_from, w.starts_on - 1, null);
      made := made || (select a.id from public.away a where a.house_id = h.id and a.user_id = p_user and a.starts_on = free_from);
    end if;
    free_from := greatest(free_from, w.ends_on + 1);
  end loop;
  if free_from <= last_day then
    perform public.start_away(p_user, free_from, last_day, null);
    made := made || (select a.id from public.away a where a.house_id = h.id and a.user_id = p_user and a.starts_on = free_from);
  end if;
  return made;
end;
$$;

-- Takes back time away a deletion put in, as cancel_away does: what's still
-- to come goes, and one under way ends yesterday.
create function public.end_deletion_away(p_away uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  a public.away;
  tz text;
  today date;
begin
  select * into a from public.away where id = p_away;
  if a.id is null then
    return;
  end if;
  select timezone into tz from public.houses where id = a.house_id;
  today := (now() at time zone tz)::date;
  if a.ends_on < today then
    return;
  end if;

  update public.assignments
  set due_at = due_moved_from, due_moved_from = null, reminded = 0
  where house_id = a.house_id and user_id = a.user_id
    and done_at is null and outcome is null
    and due_moved_from is not null and due_moved_from > now()
    and (due_moved_from at time zone tz)::date between greatest(a.starts_on, today) and a.ends_on;

  if a.starts_on >= today then
    delete from public.away where id = a.id;
    delete from public.events where house_id = a.house_id and kind = 'away' and data ->> 'away' = a.id::text;
  else
    update public.away set ends_on = today - 1 where id = a.id;
  end if;
end;
$$;

-- What the owner does to someone's house goes unrecorded in its History:
-- the owner isn't one of them (recording(), 20261101090000).
create function public.quietly(p_on boolean)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('johns.undoing', case when p_on then 'on' else '' end, true);
end;
$$;

-- --- Asking, and changing your mind ----------------------------------------------------

-- What the Delete sheet says: your house, until when a Pass you pay for
-- covers it (it stops renewing), and the day the account would go.
create function public.account_deletion_preview()
returns jsonb
language sql
stable
security definer set search_path = ''
as $$
  select jsonb_build_object(
    'house', h.name,
    'pass_until', case
      when h.pass_buyer = me.id and h.pass_plan in ('monthly', 'yearly') and h.pass_until > now()
      then (h.pass_until at time zone h.timezone)::date
    end,
    'delete_after', now() + interval '30 days'
  )
  from (select auth.uid() as id) me
  left join public.members m on m.user_id = me.id
  left join public.houses h on h.id = m.house_id
  where me.id is not null;
$$;

-- Start the 30 days. Asking again while they run changes nothing. Says when it goes.
create function public.request_account_deletion()
returns timestamptz
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  d public.account_deletions;
begin
  select * into d from public.account_deletions where user_id = me and state = 'pending';
  if d.id is not null then
    return d.delete_after;
  end if;
  insert into public.account_deletions (user_id, delete_after, requested_by)
  values (me, now() + interval '30 days', 'self')
  returning * into d;
  update public.account_deletions set away_ids = public.deletion_away(me, d.delete_after) where id = d.id;
  insert into public.admin_audit (actor, action, target_kind, target_id, after)
  values (me, 'account.delete_request', 'account', me::text,
    jsonb_build_object('requested_by', 'self', 'delete_after', d.delete_after));
  return d.delete_after;
end;
$$;

-- Ends a wait (Keep my account, or the owner's Stop) and takes the time away back out.
create function public.end_account_deletion(p_user uuid, p_action text, p_reason text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  d public.account_deletions;
  away uuid;
begin
  select * into d from public.account_deletions where user_id = p_user and state = 'pending' for update;
  if d.id is null then
    raise exception 'no_deletion';
  end if;
  update public.account_deletions set state = 'kept', ended_at = now() where id = d.id;
  foreach away in array d.away_ids loop
    perform public.end_deletion_away(away);
  end loop;
  insert into public.admin_audit (actor, action, target_kind, target_id, reason, before, after)
  values (auth.uid(), p_action, 'account', p_user::text, nullif(btrim(coalesce(p_reason, '')), ''),
    jsonb_build_object('state', 'pending', 'delete_after', d.delete_after),
    jsonb_build_object('state', 'kept'));
end;
$$;

-- Keep my account: the wait stops, the time away goes, and the clock starts
-- a House Pass you pay for renewing again.
create function public.keep_account()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
begin
  if exists (select 1 from public.account_deletions where user_id = me and state = 'pending') then
    perform public.end_account_deletion(me, 'account.delete_keep', null);
  end if;
end;
$$;

-- Yours, while it's waiting: when it goes. Null when it isn't.
create function public.account_deletion_status()
returns jsonb
language sql
stable
security definer set search_path = ''
as $$
  select jsonb_build_object('delete_after', d.delete_after, 'requested_by', d.requested_by)
  from public.account_deletions d
  where d.user_id = auth.uid() and d.state = 'pending';
$$;

-- --- The owner's Deletions page --------------------------------------------------------

-- Everyone waiting, soonest first, with their email to match a request by.
create function public.owner_deletions()
returns table (
  user_id uuid,
  name text,
  email text,
  house_name text,
  requested_at timestamptz,
  delete_after timestamptz,
  requested_by text
)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'owner_only' using errcode = '42501';
  end if;
  return query
    select d.user_id, p.display_name, u.email::text, h.name, d.requested_at, d.delete_after, d.requested_by
    from public.account_deletions d
    join public.profiles p on p.id = d.user_id
    left join auth.users u on u.id = d.user_id
    left join public.members m on m.user_id = d.user_id
    left join public.houses h on h.id = m.house_id
    where d.state = 'pending'
    order by d.delete_after, d.user_id;
end;
$$;

-- Delete now: the clock takes it at its next turn, within ten minutes.
create function public.owner_delete_now(p_user uuid, p_reason text default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  d public.account_deletions;
begin
  if not public.is_owner() then
    raise exception 'owner_only' using errcode = '42501';
  end if;
  select * into d from public.account_deletions where user_id = p_user and state = 'pending' for update;
  if d.id is null then
    raise exception 'no_deletion';
  end if;
  update public.account_deletions set delete_after = least(delete_after, now()) where id = d.id;
  insert into public.admin_audit (actor, action, target_kind, target_id, reason, before, after)
  values (auth.uid(), 'account.delete_now', 'account', p_user::text, nullif(btrim(coalesce(p_reason, '')), ''),
    jsonb_build_object('delete_after', d.delete_after),
    jsonb_build_object('delete_after', least(d.delete_after, now())));
end;
$$;

-- Stop: as if they'd pressed Keep my account.
create function public.owner_stop_deletion(p_user uuid, p_reason text default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'owner_only' using errcode = '42501';
  end if;
  perform public.quietly(true);
  perform public.end_account_deletion(p_user, 'account.delete_stop', p_reason);
  perform public.quietly(false);
end;
$$;

-- Start the 30 days for someone who asked by email (from that address):
-- the same wait as asking in the app. Says whose account it is.
create function public.owner_request_deletion(p_email text, p_reason text default null)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  who uuid;
  d public.account_deletions;
begin
  if not public.is_owner() then
    raise exception 'owner_only' using errcode = '42501';
  end if;
  select u.id into who from auth.users u
  where lower(u.email) = lower(btrim(p_email)) and u.deleted_at is null
    and exists (select 1 from public.profiles p where p.id = u.id and p.deleted_at is null);
  if who is null then
    raise exception 'no_account';
  end if;
  if exists (select 1 from public.account_deletions where user_id = who and state = 'pending') then
    raise exception 'already_deleting';
  end if;
  insert into public.account_deletions (user_id, delete_after, requested_by)
  values (who, now() + interval '30 days', 'owner')
  returning * into d;
  perform public.quietly(true);
  update public.account_deletions set away_ids = public.deletion_away(who, d.delete_after) where id = d.id;
  perform public.quietly(false);
  insert into public.admin_audit (actor, action, target_kind, target_id, reason, after)
  values (auth.uid(), 'account.delete_request', 'account', who::text, nullif(btrim(coalesce(p_reason, '')), ''),
    jsonb_build_object('requested_by', 'owner', 'delete_after', d.delete_after));
  return who;
end;
$$;

-- --- The day it goes -------------------------------------------------------------------

-- The database's part, for the clock (service role): leave the house,
-- handing it to the longest-standing housemate if they were its only admin
-- (the last one out leaves it empty, and an empty house is closed), and
-- take away their name, photo, reminders and open asks. What the house did
-- stays, as "Someone who left". The API then deletes the photo file and the
-- sign-in. Safe to run again.
create function public.finish_account_deletion(p_user uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  m public.members;
  heir uuid;
begin
  select * into m from public.members where user_id = p_user;
  if m.house_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('johns.members:' || m.house_id::text, 0));
    if m.role = 'admin' and not exists (
      select 1 from public.members where house_id = m.house_id and role = 'admin' and user_id <> p_user
    ) then
      select x.user_id into heir from public.members x
      where x.house_id = m.house_id and x.user_id <> p_user
      order by x.joined_at, x.user_id
      limit 1;
      if heir is not null then
        update public.members set role = 'admin' where house_id = m.house_id and user_id = heir;
      end if;
    end if;
    delete from public.members where house_id = m.house_id and user_id = p_user;
  end if;

  update public.houses set pass_buyer = null where pass_buyer = p_user;
  delete from public.push_subscriptions where user_id = p_user;
  delete from public.notification_prefs where user_id = p_user;
  delete from public.swap_offers where (asked_by = p_user or asked_to = p_user) and answer is null;
  -- The Wall said their name when they moved out; it can't look it up now.
  update public.events set data = data || jsonb_build_object('who', 'Someone who left')
  where user_id = p_user and data ? 'who';
  update public.profiles
  set display_name = 'Someone who left', avatar_url = null, deleted_at = coalesce(deleted_at, now())
  where id = p_user;
end;
$$;

-- --- Grants ----------------------------------------------------------------------------

revoke execute on function
  public.start_away(uuid, date, date, text), public.set_away(date, date, text),
  public.deletion_away(uuid, timestamptz), public.end_deletion_away(uuid), public.quietly(boolean),
  public.account_deletion_preview(), public.request_account_deletion(),
  public.end_account_deletion(uuid, text, text), public.keep_account(), public.account_deletion_status(),
  public.owner_deletions(), public.owner_delete_now(uuid, text), public.owner_stop_deletion(uuid, text),
  public.owner_request_deletion(text, text), public.finish_account_deletion(uuid)
from public, anon, authenticated;
grant execute on function
  public.set_away(date, date, text),
  public.account_deletion_preview(), public.request_account_deletion(), public.keep_account(),
  public.account_deletion_status(),
  public.owner_deletions(), public.owner_delete_now(uuid, text), public.owner_stop_deletion(uuid, text),
  public.owner_request_deletion(text, text)
to authenticated;
grant execute on function
  public.set_away(date, date, text), public.start_away(uuid, date, date, text),
  public.finish_account_deletion(uuid)
to service_role;
