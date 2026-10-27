-- On-call Johns: Johns that need doing whenever they need doing (the bins
-- when they're full), not on a set day.
--
-- A John is either due on a day (every John so far) or on call. The deal
-- puts one housemate on call for each on-call John, for the week
-- (on_call). Anyone in the house can then flag it ("Needs doing"): a flag
-- is an ordinary assignment for whoever is on call, due respond_hours after
-- it was raised, so it is done, late or missed like any other John.
--
-- A flag belongs to whoever was on call when it was raised, even after the
-- deal moves the John to someone else. It turns missed at twice its window,
-- or when its week ends if it is already overdue by then
-- (@app/core outcome.ts, flagClosesAt), and the engine then opens a fresh
-- flag for whoever is on call now.
--
-- Shares: an on-call John adds nothing to the week's stored shares when it is
-- dealt. Each flag adds its points, split equally among the John's sharers,
-- when it is raised, so what the house was handed and what it owed stay
-- equal however often the bin fills.

-- --- The list ----------------------------------------------------------------------

alter table public.johns add column kind text not null default 'day'
  check (kind in ('day', 'on_call'));
-- How long whoever is on call has to do a flagged John.
alter table public.johns add column respond_hours smallint not null default 12
  check (respond_hours between 1 and 72);
-- About how often an on-call John needs doing in a week: only its weight in the deal.
alter table public.johns add column per_week smallint not null default 2
  check (per_week between 1 and 14);

grant insert (kind, respond_hours, per_week), update (kind, respond_hours, per_week)
  on public.johns to authenticated;

-- --- Who is on call ------------------------------------------------------------------

create table public.on_call (
  week_id uuid not null references public.weeks (id) on delete cascade,
  house_id uuid not null references public.houses (id) on delete cascade,
  john_id uuid not null references public.johns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (week_id, john_id)
);

create index on_call_house on public.on_call (house_id);

alter table public.on_call enable row level security;
create policy "members see who is on call" on public.on_call
  for select to authenticated using (public.is_member(house_id));

revoke all on public.on_call from anon, authenticated;
grant select on public.on_call to authenticated;
grant select, insert, update, delete on public.on_call to service_role;

-- --- Flags ---------------------------------------------------------------------------

-- Set on a flag: who flagged it (null when the engine opened it again after a
-- miss) and when. A flag's due_at is flagged_at plus the John's respond_hours.
alter table public.assignments add column flagged_by uuid references public.profiles (id) on delete set null;
alter table public.assignments add column flagged_at timestamptz;

create index assignments_open_flags on public.assignments (john_id)
  where flagged_at is not null and outcome is null;

-- 'covered' belongs to covering someone else's John, which ships on its own;
-- it is listed here too so neither migration drops the other's kind.
alter table public.events drop constraint events_kind_check;
alter table public.events add constraint events_kind_check check (kind in (
  'joined', 'done', 'late', 'missed', 'disputed', 'upheld', 'rejected',
  'immunity_earned', 'immunity_used', 'swap_earned', 'swap_used',
  'week_dealt', 'month_closed', 'paid', 'away', 'flagged', 'covered'
));

-- When an open John turns missed: its week's end, or for a flag twice its
-- window (the week's end instead, if it is overdue by then). Mirrors
-- flagClosesAt in @app/core outcome.ts.
create function public.closes_at(a public.assignments, week_ends timestamptz)
returns timestamptz
language sql
immutable
as $$
  select case
    when a.flagged_at is null then week_ends
    when a.due_at < week_ends then least(week_ends, a.due_at + (a.due_at - a.flagged_at))
    else a.due_at + (a.due_at - a.flagged_at)
  end
$$;

-- An assignment the caller holds, locked for the rest of the transaction. A
-- flag stays open past its week's end until it closes.
create or replace function public.my_open_assignment(p_assignment uuid)
returns public.assignments
language plpgsql
security definer set search_path = ''
as $$
declare
  a public.assignments;
  ends timestamptz;
begin
  select * into a from public.assignments where id = p_assignment for update;
  if a.id is null or a.user_id <> (select auth.uid()) then
    raise exception 'not_your_john' using errcode = '42501';
  end if;
  if a.outcome is not null then
    raise exception 'already_settled';
  end if;
  select w.ends_at into ends from public.weeks w where w.id = a.week_id;
  if now() >= public.closes_at(a, ends) then
    raise exception 'week_closed';
  end if;
  return a;
end;
$$;

-- A flag is the job of whoever was on call when it was raised: swaps trade
-- Johns due on a day only.
create or replace function public.use_swap(p_mine uuid, p_theirs uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  mine public.assignments := public.my_open_assignment(p_mine);
  theirs public.assignments;
begin
  select * into theirs from public.assignments where id = p_theirs for update;
  if theirs.id is null or theirs.house_id <> mine.house_id or theirs.week_id <> mine.week_id
     or theirs.user_id = mine.user_id then
    raise exception 'not_swappable';
  end if;
  if mine.done_at is not null or theirs.done_at is not null or theirs.outcome is not null
     or mine.flagged_at is not null or theirs.flagged_at is not null then
    raise exception 'not_swappable';
  end if;
  update public.members set swap_tokens = swap_tokens - 1
  where house_id = mine.house_id and user_id = mine.user_id and swap_tokens > 0;
  if not found then
    raise exception 'no_swap';
  end if;
  update public.assignments set user_id = theirs.user_id, reminded = 0 where id = mine.id;
  update public.assignments set user_id = mine.user_id, reminded = 0 where id = theirs.id;
  insert into public.events (house_id, kind, user_id, assignment_id, data)
  values (mine.house_id, 'swap_used', mine.user_id, theirs.id,
          jsonb_build_object('gave', mine.name, 'took', theirs.name, 'with', theirs.user_id));
end;
$$;

-- Open a flag on an on-call John, for whoever is on call this week. If that
-- housemate is away today, or nobody was dealt it, it goes to whoever of its
-- sharers is home and has been handed least this week. A flag already open
-- (not yet ticked) is returned as it is: flagging twice changes nothing.
-- The engine's half: raise_flag is the housemates'.
create function public.open_flag(p_john uuid, p_at timestamptz, p_by uuid default null)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  j public.johns;
  h public.houses;
  w public.weeks;
  today date;
  holder uuid;
  sharers uuid[];
  existing uuid;
  flag uuid;
  group_label text;
begin
  select * into j from public.johns where id = p_john for update;
  if j.id is null or j.archived_at is not null or j.kind <> 'on_call' then
    raise exception 'not_on_call';
  end if;
  select * into h from public.houses where id = j.house_id;
  select * into w from public.weeks
  where house_id = j.house_id and starts_at <= p_at and ends_at > p_at;
  if w.id is null then
    raise exception 'not_dealt';
  end if;

  select id into existing from public.assignments
  where john_id = j.id and flagged_at is not null and done_at is null and outcome is null
  order by flagged_at desc limit 1;
  if existing is not null then
    return existing;
  end if;

  today := (p_at at time zone h.timezone)::date;
  select coalesce(array_agg(gm.user_id), '{}') into sharers
  from public.group_members gm
  where gm.group_id = j.group_id and gm.house_id = j.house_id;
  if j.group_id is null or cardinality(sharers) = 0 then
    select array_agg(m.user_id) into sharers from public.members m where m.house_id = j.house_id;
  else
    select g.name into group_label from public.groups g where g.id = j.group_id;
  end if;

  select oc.user_id into holder from public.on_call oc
  where oc.week_id = w.id and oc.john_id = j.id
    and oc.user_id = any (sharers)
    and not exists (
      select 1 from public.away a
      where a.house_id = j.house_id and a.user_id = oc.user_id and today between a.starts_on and a.ends_on
    );
  if holder is null then
    select s.id into holder
    from unnest(sharers) as s (id)
    where not exists (
      select 1 from public.away a
      where a.house_id = j.house_id and a.user_id = s.id and today between a.starts_on and a.ends_on
    )
    order by (
      select coalesce(sum(x.points), 0) from public.assignments x where x.week_id = w.id and x.user_id = s.id
    ), s.id
    limit 1;
  end if;
  if holder is null then
    raise exception 'nobody_home';
  end if;

  -- reminded = 1: the flag's own push says it needs doing, so the clock only
  -- sends the "due soon" one.
  insert into public.assignments
    (week_id, house_id, john_id, user_id, name, category, points, needs_photo, due_at,
     group_name, flagged_by, flagged_at, reminded)
  values
    (w.id, j.house_id, j.id, holder, j.name, j.category, j.points, j.needs_photo,
     p_at + make_interval(hours => j.respond_hours), group_label, p_by, p_at, 1)
  returning id into flag;

  insert into public.week_shares (week_id, house_id, user_id, share)
  select w.id, j.house_id, s.id, round(j.points::numeric / cardinality(sharers), 2)
  from unnest(sharers) as s (id)
  on conflict (week_id, user_id) do update set share = public.week_shares.share + excluded.share;

  insert into public.events (house_id, kind, user_id, assignment_id, data)
  values (j.house_id, 'flagged', holder, flag,
          jsonb_build_object('name', j.name, 'by', p_by, 'due_at', p_at + make_interval(hours => j.respond_hours)));
  return flag;
end;
$$;

-- "Needs doing": any housemate flags an on-call John in their house.
create function public.raise_flag(p_john uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  house uuid;
begin
  select house_id into house from public.johns where id = p_john;
  if house is null or not public.is_member(house) then
    raise exception 'not_in_house' using errcode = '42501';
  end if;
  return public.open_flag(p_john, now(), me);
end;
$$;

-- --- The deal, with who is on call ---------------------------------------------------------

drop function public.deal_week(uuid, date, timestamptz, timestamptz, jsonb, jsonb, boolean);

-- Deal a week: its assignments, every housemate's share of it, and who is on
-- call for each on-call John, together. With p_replace, re-deal one that
-- nobody has ticked or flagged yet.
create function public.deal_week(
  p_house uuid,
  p_starts_on date,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_assignments jsonb,
  p_shares jsonb,
  p_replace boolean default false,
  p_on_call jsonb default '[]'::jsonb
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
      where week_id = week and (done_at is not null or outcome is not null or flagged_at is not null)
    ) then
      raise exception 'week_started';
    end if;
    delete from public.assignments where week_id = week;
    delete from public.week_shares where week_id = week;
    delete from public.on_call where week_id = week;
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

  insert into public.on_call (week_id, house_id, john_id, user_id)
  select week, p_house, (x ->> 'john_id')::uuid, (x ->> 'user_id')::uuid
  from jsonb_array_elements(p_on_call) x;

  update public.houses set first_dealt_at = coalesce(first_dealt_at, now()) where id = p_house;
  insert into public.events (house_id, kind, data)
  values (p_house, 'week_dealt', jsonb_build_object(
    'starts_on', p_starts_on,
    'count', jsonb_array_length(p_assignments) + jsonb_array_length(p_on_call)
  ));
  return week;
end;
$$;

-- --- Grants ------------------------------------------------------------------------------

revoke execute on function
  public.closes_at(public.assignments, timestamptz),
  public.open_flag(uuid, timestamptz, uuid),
  public.raise_flag(uuid),
  public.deal_week(uuid, date, timestamptz, timestamptz, jsonb, jsonb, boolean, jsonb)
from public, anon, authenticated;
grant execute on function public.raise_flag(uuid) to authenticated;
grant execute on function
  public.closes_at(public.assignments, timestamptz),
  public.open_flag(uuid, timestamptz, uuid),
  public.raise_flag(uuid),
  public.deal_week(uuid, date, timestamptz, timestamptz, jsonb, jsonb, boolean, jsonb)
to service_role;

alter publication supabase_realtime add table public.on_call;
