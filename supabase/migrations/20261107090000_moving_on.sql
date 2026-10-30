-- Bring Jonz to your next house (docs/specs/moving-on.md).
--
-- Every lease that ends sends three or four people into new houses, each of
-- whom already knows Jonz. Four pieces:
--
-- 1. A moving-out date (members.moving_out_on, the house's local date, set
--    and cleared by set_moving_out). From that day the deal leaves them out
--    (the engine reads it), and the Wall says so.
-- 2. moved_on: one row each time someone leaves a house themselves, filled
--    in when they next start or join one. It is what the Moving on screen
--    reads, what the one reminder two weeks later is sent from, and how we
--    count houses that came from a move.
-- 3. start_house_from: a new house with the old one's John list already on
--    it (groups stay behind: they name people who aren't coming).
-- 4. A 'moving_out' and a 'moved_out' kind on the Wall, so the people who
--    stay are told, and asked who's moving in.

-- --- 1. The moving-out date ---------------------------------------------------------------

alter table public.members add column moving_out_on date;

-- The Wall's two new kinds, added to the live list as 20261101090000 does.
do $$
declare
  k text;
  def text;
begin
  foreach k in array array['moving_out', 'moved_out'] loop
    select pg_get_constraintdef(oid) into def
    from pg_catalog.pg_constraint
    where conrelid = 'public.events'::regclass and conname = 'events_kind_check';
    if def is null or def like '%''' || k || '''%' then
      continue;
    end if;
    execute 'alter table public.events drop constraint events_kind_check';
    execute 'alter table public.events add constraint events_kind_check '
      || replace(def, 'ARRAY[', 'ARRAY[''' || k || '''::text, ');
  end loop;
end;
$$;

-- Say the day you move out (today or later, within a year), or null when
-- you're staying after all. The Wall hears either way.
create function public.set_moving_out(p_on date)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  h public.houses;
  today date;
  was date;
begin
  select houses.* into h
  from public.houses join public.members m on m.house_id = houses.id
  where m.user_id = me;
  if h.id is null then
    raise exception 'not_in_house' using errcode = '42501';
  end if;
  today := (now() at time zone h.timezone)::date;
  if p_on is not null and p_on < today then
    raise exception 'moving_in_past';
  end if;
  if p_on is not null and p_on > today + 365 then
    raise exception 'moving_too_far';
  end if;
  select moving_out_on into was from public.members where house_id = h.id and user_id = me for update;
  if was is not distinct from p_on then
    return;
  end if;
  update public.members set moving_out_on = p_on where house_id = h.id and user_id = me;
  insert into public.events (house_id, kind, user_id, data)
  values (h.id, 'moving_out', me, jsonb_build_object('on', p_on));
end;
$$;

-- --- 2. moved_on ---------------------------------------------------------------------------

create table public.moved_on (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The house they left. It stays in the database when the last one out closes it.
  from_house uuid not null references public.houses (id) on delete cascade,
  left_at timestamptz not null default now(),
  -- Where they went next, and how: a house with the old list ('copied'), an
  -- empty one ('started'), or one they were invited to ('joined').
  to_house uuid references public.houses (id) on delete set null,
  how text check (how in ('copied', 'started', 'joined')),
  moved_at timestamptz,
  -- The one reminder ("Settled into your new place?"), once sent.
  reminded_at timestamptz,
  check ((to_house is null) = (how is null) and (how is null) = (moved_at is null))
);

create index moved_on_user on public.moved_on (user_id, left_at desc);
-- What the clock looks through for the reminder.
create index moved_on_waiting on public.moved_on (left_at) where how is null and reminded_at is null;

alter table public.moved_on enable row level security;

-- Your own moves only; nobody else's, and only the functions write.
create policy "your own moves" on public.moved_on
  for select to authenticated using (user_id = auth.uid());

revoke all on public.moved_on from public, anon, authenticated;
grant select on public.moved_on to authenticated;
grant select, insert, update, delete on public.moved_on to service_role;

-- Fill in where someone went next, on the move they made most recently.
create function public.record_moved_on(p_user uuid, p_to uuid, p_how text)
returns void
language sql
security definer set search_path = ''
as $$
  update public.moved_on set to_house = p_to, how = p_how, moved_at = now()
  where id = (
    select id from public.moved_on
    where user_id = p_user and how is null and from_house <> p_to
    order by left_at desc
    limit 1
  );
$$;

-- Leave, or (as an admin) ask someone to. As 20261030120000, and now
-- someone who leaves themselves (or is asked to, with a moving-out date
-- said) gets a moved_on row, and the people who stay see them go.
create or replace function public.remove_member(p_house uuid, p_user uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  leaving public.members;
begin
  perform pg_advisory_xact_lock(hashtextextended('johns.members:' || p_house::text, 0));
  if p_user <> me and not public.is_admin(p_house) then
    raise exception 'admins_only' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.members where house_id = p_house and user_id = p_user and role = 'admin'
  ) and not exists (
    select 1 from public.members where house_id = p_house and role = 'admin' and user_id <> p_user
  ) and exists (
    select 1 from public.members where house_id = p_house and user_id <> p_user
  ) then
    raise exception 'last_admin';
  end if;
  delete from public.members where house_id = p_house and user_id = p_user
  returning * into leaving;
  if leaving.user_id is null then
    return;
  end if;
  if p_user <> me then
    update public.houses set join_code = public.new_join_code() where id = p_house;
  end if;
  if p_user = me or leaving.moving_out_on is not null then
    insert into public.moved_on (user_id, from_house) values (p_user, p_house);
    -- Their name goes with the post: once they've gone, the Wall can't look it up.
    if exists (select 1 from public.members where house_id = p_house) then
      insert into public.events (house_id, kind, user_id, data)
      select p_house, 'moved_out', p_user, jsonb_build_object('who', p.display_name)
      from public.profiles p where p.id = p_user;
    end if;
  end if;
end;
$$;

-- Starting a house, as before (20261011000000), and now a move's next house is written down.
create or replace function public.create_house(
  p_name text,
  p_timezone text,
  p_currency text,
  p_week_starts smallint
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  house uuid;
begin
  if exists (select 1 from public.members where user_id = me) then
    raise exception 'already_in_house';
  end if;
  insert into public.houses (name, timezone, currency, week_starts, created_by)
  values (btrim(p_name), p_timezone, p_currency, p_week_starts, me)
  returning id into house;
  insert into public.members (house_id, user_id, role) values (house, me, 'admin');
  insert into public.events (house_id, kind, user_id) values (house, 'joined', me);
  perform public.record_moved_on(me, house, 'started');
  return house;
end;
$$;

-- Joining, as 20261027094000, and now a move's next house is written down.
create or replace function public.join_house(p_code text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  house uuid;
begin
  select id into house from public.houses where join_code = upper(btrim(p_code));
  if house is null then
    raise exception 'unknown_code';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('johns.members:' || house::text, 0));
  if not exists (select 1 from public.members where house_id = house) then
    raise exception 'unknown_code';
  end if;
  if exists (select 1 from public.members where house_id = house and user_id = me) then
    return house;
  end if;
  if exists (select 1 from public.members where user_id = me) then
    raise exception 'already_in_house';
  end if;
  insert into public.members (house_id, user_id) values (house, me);
  insert into public.events (house_id, kind, user_id) values (house, 'joined', me);
  perform public.record_moved_on(me, house, 'joined');
  return house;
end;
$$;

-- --- 3. start_house_from -------------------------------------------------------------------

-- What the Moving on screen offers: the house you left most recently (in
-- the last 90 days, and not since moved on from), its name, and how many
-- Johns would come with you. Nothing when there's no such move.
create function public.moving_on()
returns table (from_house uuid, house_name text, johns bigint, left_at timestamptz)
language sql
stable
security definer set search_path = ''
as $$
  select o.from_house, h.name,
    (select count(*) from public.johns j where j.house_id = o.from_house and j.archived_at is null),
    o.left_at
  from public.moved_on o join public.houses h on h.id = o.from_house
  where o.user_id = auth.uid() and o.how is null and o.left_at > now() - interval '90 days'
  order by o.left_at desc
  limit 1;
$$;

-- A new house with the John list of the house you left: every John on it as
-- it stood, except its group (groups name people), and nothing else (no
-- weeks, no history, no rules beyond the four a new house is asked). Only
-- the house on your own open move: you can't copy a house you never left.
create function public.start_house_from(
  p_from uuid,
  p_name text,
  p_timezone text,
  p_currency text,
  p_week_starts smallint
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  house uuid;
begin
  if not exists (
    select 1 from public.moved_on
    where user_id = me and from_house = p_from and how is null and left_at > now() - interval '90 days'
  ) then
    raise exception 'not_your_move' using errcode = '42501';
  end if;
  house := public.create_house(p_name, p_timezone, p_currency, p_week_starts);
  insert into public.johns (
    house_id, name, category, points, every_weeks, anchor_week, every_months, anchor_month,
    week_of_month, due_dow, due_time, needs_photo, kind, respond_hours, per_week, crew, keep_day
  )
  select house, j.name, j.category, j.points, j.every_weeks, j.anchor_week, j.every_months, j.anchor_month,
    j.week_of_month, j.due_dow, j.due_time, j.needs_photo, j.kind, j.respond_hours, j.per_week, j.crew, j.keep_day
  from public.johns j
  where j.house_id = p_from and j.archived_at is null
  order by j.created_at;
  update public.moved_on set how = 'copied'
  where user_id = me and to_house = house;
  return house;
end;
$$;

-- --- Grants --------------------------------------------------------------------------------

revoke execute on function
  public.set_moving_out(date), public.record_moved_on(uuid, uuid, text),
  public.remove_member(uuid, uuid), public.create_house(text, text, text, smallint),
  public.join_house(text), public.moving_on(),
  public.start_house_from(uuid, text, text, text, smallint)
from public, anon, authenticated;
grant execute on function
  public.set_moving_out(date), public.remove_member(uuid, uuid),
  public.create_house(text, text, text, smallint), public.join_house(text), public.moving_on(),
  public.start_house_from(uuid, text, text, text, smallint)
to authenticated, service_role;
grant execute on function public.record_moved_on(uuid, uuid, text) to service_role;
