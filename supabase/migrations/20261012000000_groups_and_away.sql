-- Groups, time away, and the stored shares that make time away fair.
--
-- Groups: some Johns belong to only part of the house (three share the
-- upstairs bathroom, two the downstairs one). A John with a group is dealt
-- only to that group and counts only toward their shares.
--
-- Time away: nobody is dealt a John that falls due on a day they are away,
-- but time away is not a holiday from your share. Every deal now stores each
-- housemate's share of the week (week_shares); what someone was handed minus
-- their share carries forward, so time away is made up afterwards, a little
-- each week (lib/deal.ts). How much of it is made up is the house's call
-- (houses.away_makeup). And the Johns you already have do not disappear when
-- you book time away: set_away makes the ones due while you're gone due
-- before you go.

-- --- Groups ---------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (house_id, name),
  unique (id, house_id)
);

create table public.group_members (
  group_id uuid not null,
  house_id uuid not null,
  user_id uuid not null,
  primary key (group_id, user_id),
  foreign key (group_id, house_id) references public.groups (id, house_id) on delete cascade,
  -- Leaving the house leaves its groups.
  foreign key (house_id, user_id) references public.members (house_id, user_id) on delete cascade
);

create index group_members_house on public.group_members (house_id);

-- A John belongs to everyone (null) or to one group in its own house. Deleting
-- the group hands its Johns back to everyone.
alter table public.johns add column group_id uuid;
alter table public.johns add constraint johns_group_in_house
  foreign key (group_id, house_id) references public.groups (id, house_id) on delete set null (group_id);

-- The group's name as it was dealt, like the rest of the snapshot.
alter table public.assignments add column group_name text;

-- --- Time away ------------------------------------------------------------------

-- How much of an away housemate's share they still owe: 100 in full, 50 half, 0 none.
alter table public.houses add column away_makeup smallint not null default 100
  check (away_makeup in (0, 50, 100));

-- Local calendar dates in the house's zone, first and last away day inclusive.
create table public.away (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null,
  user_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  note text check (note is null or char_length(note) <= 60),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 91),
  foreign key (house_id, user_id) references public.members (house_id, user_id) on delete cascade
);

create index away_house on public.away (house_id, ends_on);

-- When set_away pulled a John forward, when it was due before, so cancelling
-- the trip can put it back.
alter table public.assignments add column due_moved_from timestamptz;

-- --- Shares ---------------------------------------------------------------------

-- Each housemate's share of a dealt week, in points. A balance is the sum of
-- what someone was handed minus these, over recent weeks.
create table public.week_shares (
  week_id uuid not null references public.weeks (id) on delete cascade,
  house_id uuid not null references public.houses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  share numeric(7, 2) not null check (share >= 0),
  primary key (week_id, user_id)
);

create index week_shares_house on public.week_shares (house_id);

-- --- The Wall learns about time away ----------------------------------------------

alter table public.events drop constraint events_kind_check;
alter table public.events add constraint events_kind_check check (kind in (
  'joined', 'done', 'late', 'missed', 'disputed', 'upheld', 'rejected',
  'immunity_earned', 'immunity_used', 'swap_earned', 'swap_used',
  'week_dealt', 'month_closed', 'paid', 'away'
));

-- --- Row-level security --------------------------------------------------------------

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.away enable row level security;
alter table public.week_shares enable row level security;

create policy "members see groups" on public.groups
  for select to authenticated using (public.is_member(house_id));
create policy "members see who is in a group" on public.group_members
  for select to authenticated using (public.is_member(house_id));
create policy "members see time away" on public.away
  for select to authenticated using (public.is_member(house_id));
create policy "members see shares" on public.week_shares
  for select to authenticated using (public.is_member(house_id));

-- Stated, not inherited, as in the first migration: reads through RLS, writes
-- only through the functions below (and the engine as service_role).
revoke all on public.groups, public.group_members, public.away, public.week_shares from anon, authenticated;
grant select on public.groups, public.group_members, public.away, public.week_shares to authenticated;
grant select, insert, update, delete on public.groups, public.group_members, public.away, public.week_shares
  to service_role;
grant update (away_makeup) on public.houses to authenticated;
grant insert (group_id), update (group_id) on public.johns to authenticated;

-- --- Housemate functions --------------------------------------------------------------

-- Create or rewrite a group: its name and exactly who is in it. Admins only.
create function public.save_group(p_house uuid, p_group uuid, p_name text, p_members uuid[])
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  g uuid := p_group;
begin
  perform public.require_user();
  if not public.is_admin(p_house) then
    raise exception 'admins_only' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_members), 0) = 0 then
    raise exception 'group_empty';
  end if;
  if exists (
    select 1 from unnest(p_members) as u (id)
    where not exists (select 1 from public.members m where m.house_id = p_house and m.user_id = u.id)
  ) then
    raise exception 'not_housemates' using errcode = '22023';
  end if;
  if g is null then
    insert into public.groups (house_id, name) values (p_house, btrim(p_name)) returning id into g;
  else
    update public.groups set name = btrim(p_name) where id = g and house_id = p_house;
    if not found then
      raise exception 'unknown_group' using errcode = '22023';
    end if;
    delete from public.group_members where group_id = g;
  end if;
  insert into public.group_members (group_id, house_id, user_id)
  select distinct g, p_house, u.id from unnest(p_members) as u (id);
  return g;
exception
  when unique_violation then
    raise exception 'group_name_taken';
end;
$$;

-- Delete a group. Its Johns go back to everyone.
create function public.delete_group(p_group uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  house uuid;
begin
  perform public.require_user();
  select house_id into house from public.groups where id = p_group;
  if house is null or not public.is_admin(house) then
    raise exception 'admins_only' using errcode = '42501';
  end if;
  delete from public.groups where id = p_group;
end;
$$;

-- Book time away for yourself. It can start today at the earliest: away is
-- planned, never claimed after the fact. Any John you already have that falls
-- due while you're gone is due before you go instead: by 23:59 the night
-- before, or now if that has passed. Returns how many Johns moved.
create function public.set_away(p_starts date, p_ends date, p_note text default null)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  h public.houses;
  today date;
  away_id uuid;
  departure timestamptz;
  moved integer;
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

  departure := greatest((p_starts::timestamp at time zone h.timezone) - interval '1 minute', now());
  update public.assignments a
  set due_moved_from = coalesce(a.due_moved_from, a.due_at), due_at = departure, reminded = 0
  where a.house_id = h.id and a.user_id = me
    and a.done_at is null and a.outcome is null
    and (a.due_at at time zone h.timezone)::date between p_starts and p_ends
    and a.due_at > departure;
  get diagnostics moved = row_count;

  insert into public.events (house_id, kind, user_id, data)
  values (h.id, 'away', me, jsonb_build_object(
    'away', away_id, 'starts_on', p_starts, 'ends_on', p_ends, 'moved', moved));
  return moved;
end;
$$;

-- Cancel a trip that hasn't started, or end one early (you're back today).
-- Johns pulled forward for days you're no longer away go back to when they
-- were due.
create function public.cancel_away(p_away uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  a public.away;
  tz text;
  today date;
begin
  select * into a from public.away where id = p_away;
  if a.id is null or a.user_id <> me then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  select timezone into tz from public.houses where id = a.house_id;
  today := (now() at time zone tz)::date;
  if a.ends_on < today then
    raise exception 'away_over';
  end if;

  update public.assignments
  set due_at = due_moved_from, due_moved_from = null, reminded = 0
  where house_id = a.house_id and user_id = me
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

-- --- The engine's deal, now with shares and groups ---------------------------------------

drop function public.deal_week(uuid, date, timestamptz, timestamptz, jsonb, boolean);

-- Deal a week: its assignments and every housemate's share of it, together.
-- With p_replace, re-deal one that nobody has ticked yet.
create function public.deal_week(
  p_house uuid,
  p_starts_on date,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_assignments jsonb,
  p_shares jsonb,
  p_replace boolean default false
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  week uuid;
begin
  insert into public.weeks (house_id, starts_on, starts_at, ends_at)
  values (p_house, p_starts_on, p_starts_at, p_ends_at)
  on conflict (house_id, starts_on) do nothing
  returning id into week;

  if week is null then
    if not p_replace then
      return null;
    end if;
    select id into week from public.weeks where house_id = p_house and starts_on = p_starts_on for update;
    if exists (
      select 1 from public.assignments
      where week_id = week and (done_at is not null or outcome is not null)
    ) then
      raise exception 'week_started';
    end if;
    delete from public.assignments where week_id = week;
    delete from public.week_shares where week_id = week;
  end if;

  insert into public.assignments
    (week_id, house_id, john_id, user_id, name, category, points, needs_photo, due_at, group_name)
  select week, p_house, (x ->> 'john_id')::uuid, (x ->> 'user_id')::uuid, x ->> 'name',
         x ->> 'category', (x ->> 'points')::smallint, coalesce((x ->> 'needs_photo')::boolean, false),
         (x ->> 'due_at')::timestamptz, x ->> 'group_name'
  from jsonb_array_elements(p_assignments) x;

  insert into public.week_shares (week_id, house_id, user_id, share)
  select week, p_house, (x ->> 'user_id')::uuid, (x ->> 'share')::numeric
  from jsonb_array_elements(p_shares) x;

  update public.houses set first_dealt_at = coalesce(first_dealt_at, now()) where id = p_house;
  insert into public.events (house_id, kind, data)
  values (p_house, 'week_dealt', jsonb_build_object('starts_on', p_starts_on, 'count', jsonb_array_length(p_assignments)));
  return week;
end;
$$;

-- --- Grants ------------------------------------------------------------------------------

revoke execute on function
  public.save_group(uuid, uuid, text, uuid[]), public.delete_group(uuid),
  public.set_away(date, date, text), public.cancel_away(uuid),
  public.deal_week(uuid, date, timestamptz, timestamptz, jsonb, jsonb, boolean)
from public, anon, authenticated;
grant execute on function
  public.save_group(uuid, uuid, text, uuid[]), public.delete_group(uuid),
  public.set_away(date, date, text), public.cancel_away(uuid)
to authenticated;
grant execute on function
  public.save_group(uuid, uuid, text, uuid[]), public.delete_group(uuid),
  public.set_away(date, date, text), public.cancel_away(uuid),
  public.deal_week(uuid, date, timestamptz, timestamptz, jsonb, jsonb, boolean)
to service_role;
