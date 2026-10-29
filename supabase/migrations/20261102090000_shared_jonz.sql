-- Shared Jonz: Johns done together, and help on any John.
--
-- The one rule: a John's points are shared evenly by everyone who did it.
--
-- A John's "Done by" (johns.crew) is 1 as before, 2 to 6, or 0 for everyone
-- home. Its points are per person, so a garden tidy done by 3 at 4 points is
-- 12 in all. The deal hands it out as one place per person (an assignment
-- each, linked by assignments.job_id), to the sharers home who are furthest
-- behind, so in the week's shares it counts like any 12-point John.
--
-- Whoever ticks a John says who did it: the roll call (roll_call). Everyone
-- on it shares the points of the places it settles, helpers included: a
-- 2-point bins done with a housemate's help is 1 each. A place whose holder
-- isn't on it is marked absent (assignments.absent_at): once the tick stands
-- it settles as missed, with the miss's forfeit, and its part goes to the
-- people who did the job, as a cover's does, and so does that forfeit
-- (ledger.doers), shared at month end. Someone away keeps their place
-- excused, as now. Who did it is kept in public.crew with what each earned.
--
-- One check for the whole job: a dispute is on the place it was ticked from,
-- anyone but whoever ticked it can raise it or vote, and upheld opens every
-- place the roll call settled again. Covering a Together John that nobody
-- has ticked covers all of its open places, and the coverer gets all of it.
--
-- @app/core counts the same: crew.ts, points.ts standings, record.ts, and
-- stake.ts settleMonth (doers).
--
-- After 20261101090000_undo_history and 20261101100000_admin_resets: a roll
-- call taken back any other way (History's Undo, an admin's reset or result
-- change) keeps the job whole, by trigger (see "Keeping a job whole").

-- --- Done by ------------------------------------------------------------------------

alter table public.johns add column crew smallint not null default 1
  check (crew between 0 and 6);
-- An on-call John stays one person: helping still works on its flags.
alter table public.johns add constraint johns_crew_on_call check (kind = 'day' or crew = 1);

grant insert (crew), update (crew) on public.johns to authenticated;

-- --- Places -------------------------------------------------------------------------

-- The places of one Together John in a week share a job_id (null on a John
-- done by one). absent_at: when a roll call left the holder off.
alter table public.assignments add column job_id uuid;
alter table public.assignments add column absent_at timestamptz;
alter table public.assignments add constraint assignments_absent_shape
  check (absent_at is null or (done_at is null and covered_by is null and not excused));

create index assignments_job on public.assignments (job_id) where job_id is not null;
-- One place each: nobody holds two places in one job.
create unique index assignments_one_place_each on public.assignments (job_id, user_id) where job_id is not null;

-- Who did a John, by roll call, and the points each earned: the points of
-- the places it settled over how many did it. job_id is the place's job_id,
-- or the assignment's own id for a John done by one; assignment_id is the
-- place it was ticked from. Only roll_call writes it.
create table public.crew (
  job_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  house_id uuid not null references public.houses (id) on delete cascade,
  -- Held no place it settled: came to help.
  helper boolean not null default false,
  points numeric not null check (points >= 0),
  created_at timestamptz not null default now(),
  primary key (job_id, user_id)
);

create index crew_assignment on public.crew (assignment_id);
create index crew_house on public.crew (house_id);

alter table public.crew enable row level security;
create policy "members see who did a John" on public.crew
  for select to authenticated using (public.is_member(house_id));

revoke all on public.crew from anon, authenticated;
grant select on public.crew to authenticated;
grant select, insert, update, delete on public.crew to service_role;

-- A no-show's forfeit names everyone who did the job: they share it at
-- month end, as a coverer takes a covered John's (counterparty).
alter table public.ledger add column doers uuid[];

-- --- Ticking ------------------------------------------------------------------------

-- Your own open place, as before, unless a roll call left you off it.
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
  if a.absent_at is not null then
    raise exception 'left_off';
  end if;
  select w.ends_at into ends from public.weeks w where w.id = a.week_id;
  if now() >= public.closes_at(a, ends) then
    raise exception 'week_closed';
  end if;
  return a;
end;
$$;

-- A Together John is ticked by roll call, never by one place's tick.
create or replace function public.mark_done(p_assignment uuid, p_photo_path text default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  a public.assignments := public.my_open_assignment(p_assignment);
  photo text := nullif(btrim(coalesce(p_photo_path, '')), '');
begin
  if a.done_at is not null then
    raise exception 'already_done';
  end if;
  if a.job_id is not null then
    raise exception 'roll_call_needed';
  end if;
  if a.needs_photo and photo is null then
    raise exception 'photo_required';
  end if;
  if photo is not null and photo not like a.house_id::text || '/' || a.id::text || '/%' then
    raise exception 'photo_path' using errcode = '22023';
  end if;
  update public.assignments set done_at = now(), photo_path = photo where id = a.id;
  insert into public.events (house_id, kind, user_id, assignment_id, data)
  values (
    a.house_id,
    case when now() > a.due_at then 'late' else 'done' end,
    a.user_id,
    a.id,
    jsonb_build_object('name', a.name, 'points', a.points, 'photo', photo is not null)
  );
end;
$$;

-- The roll call: tick your place and say who did it (you among them). Every
-- open place of the job is settled at once: done for its holder if they're
-- on it, absent if not. A place excused while its holder was away stays
-- excused; if they turned up anyway, its points join the share. Answers how
-- many did it.
create function public.roll_call(p_assignment uuid, p_crew uuid[], p_photo_path text default null)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  a public.assignments := public.my_open_assignment(p_assignment);
  photo text := nullif(btrim(coalesce(p_photo_path, '')), '');
  job uuid := coalesce(a.job_id, a.id);
  people uuid[];
  total integer;
  absent uuid[];
  tick timestamptz := now();
begin
  if a.done_at is not null then
    raise exception 'already_done';
  end if;
  select coalesce(array_agg(distinct x), '{}') into people from unnest(p_crew) as x where x is not null;
  if not (a.user_id = any (people)) then
    raise exception 'not_in_crew';
  end if;
  if exists (
    select 1 from unnest(people) as x
    where not exists (select 1 from public.members m where m.house_id = a.house_id and m.user_id = x)
  ) then
    raise exception 'not_in_house' using errcode = '42501';
  end if;
  if a.needs_photo and photo is null then
    raise exception 'photo_required';
  end if;
  if photo is not null and photo not like a.house_id::text || '/' || a.id::text || '/%' then
    raise exception 'photo_path' using errcode = '22023';
  end if;

  -- The job's places, locked: two roll calls racing settle it once.
  perform 1 from public.assignments where a.job_id is not null and job_id = a.job_id for update;
  if exists (
    select 1 from public.assignments
    where a.job_id is not null and job_id = a.job_id and (done_at is not null or absent_at is not null)
  ) then
    raise exception 'already_done';
  end if;

  select coalesce(sum(p.points), 0) into total
  from public.assignments p
  where (p.id = a.id or (a.job_id is not null and p.job_id = a.job_id))
    and p.done_at is null and p.covered_by is null
    and ((p.outcome is null and not p.excused) or (p.excused and p.user_id = any (people)));

  update public.assignments p
  set done_at = tick, photo_path = case when p.id = a.id then photo end
  where (p.id = a.id or (a.job_id is not null and p.job_id = a.job_id))
    and p.outcome is null and p.done_at is null and not p.excused
    and p.user_id = any (people);

  with left_off as (
    update public.assignments p
    set absent_at = tick
    where a.job_id is not null and p.job_id = a.job_id
      and p.outcome is null and p.done_at is null and p.absent_at is null and not p.excused
      and not (p.user_id = any (people))
    returning p.user_id
  )
  select coalesce(array_agg(user_id), '{}') into absent from left_off;

  insert into public.crew (job_id, user_id, assignment_id, house_id, helper, points, created_at)
  select job, x, a.id, a.house_id,
         not exists (
           select 1 from public.assignments p
           where (p.id = a.id or (a.job_id is not null and p.job_id = a.job_id))
             and p.user_id = x and (p.done_at = tick or p.excused)
         ),
         total::numeric / cardinality(people), tick
  from unnest(people) as x;

  insert into public.events (house_id, kind, user_id, assignment_id, data)
  values (
    a.house_id,
    case when tick > a.due_at then 'late' else 'done' end,
    a.user_id,
    a.id,
    jsonb_build_object(
      'name', a.name, 'points', a.points, 'photo', photo is not null,
      'with', to_jsonb(array_remove(people, a.user_id)), 'absent', to_jsonb(absent), 'total', total
    )
  );
  return cardinality(people);
end;
$$;

-- Undo takes back the whole roll call, and only whoever ticked it can.
create or replace function public.undo_done(p_assignment uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  a public.assignments := public.my_open_assignment(p_assignment);
  ticked_from uuid;
begin
  if a.done_at is null then
    return;
  end if;
  if a.covered_by is not null then
    raise exception 'john_covered';
  end if;
  select c.assignment_id into ticked_from from public.crew c where c.job_id = coalesce(a.job_id, a.id) limit 1;
  if ticked_from is not null and ticked_from <> a.id then
    raise exception 'not_your_tick';
  end if;
  if exists (select 1 from public.disputes where assignment_id = a.id and resolution is null) then
    raise exception 'under_dispute';
  end if;
  update public.assignments p set done_at = null, photo_path = null, absent_at = null
  where (p.id = a.id or (a.job_id is not null and p.job_id = a.job_id))
    and p.outcome is null and p.covered_by is null and (p.done_at = a.done_at or p.absent_at = a.done_at);
  delete from public.crew where assignment_id = a.id;
  delete from public.events
  where assignment_id = a.id and kind in ('done', 'late') and created_at >= a.done_at;
end;
$$;

-- --- Covering ------------------------------------------------------------------------

-- Covering a Together John nobody has ticked covers every open place in it,
-- and the coverer gets all of it. Someone with a place in it ticks it by
-- roll call instead.
create or replace function public.cover_john(p_assignment uuid, p_photo_path text default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  a public.assignments;
  ends timestamptz;
  grace smallint;
  photo text := nullif(btrim(coalesce(p_photo_path, '')), '');
  holders uuid[];
begin
  select * into a from public.assignments where id = p_assignment for update;
  if a.id is null or not public.is_member(a.house_id) then
    raise exception 'not_in_house' using errcode = '42501';
  end if;
  if a.user_id = me
     or (a.job_id is not null and exists (select 1 from public.assignments where job_id = a.job_id and user_id = me)) then
    raise exception 'tick_it_yourself';
  end if;
  if a.outcome is not null then
    raise exception 'already_settled';
  end if;
  if a.done_at is not null or a.excused or a.absent_at is not null then
    raise exception 'already_done';
  end if;
  select w.ends_at into ends from public.weeks w where w.id = a.week_id;
  select cover_grace_hours into grace from public.houses where id = a.house_id;
  if now() < public.cover_opens_at(a, ends, grace) then
    raise exception 'too_soon_to_cover';
  end if;
  if now() >= public.closes_at(a, ends) then
    raise exception 'week_closed';
  end if;
  if a.needs_photo and photo is null then
    raise exception 'photo_required';
  end if;
  if photo is not null and photo not like a.house_id::text || '/' || a.id::text || '/%' then
    raise exception 'photo_path' using errcode = '22023';
  end if;
  with covered as (
    update public.assignments p
    set done_at = now(), photo_path = case when p.id = a.id then photo end, covered_by = me
    where (p.id = a.id or (a.job_id is not null and p.job_id = a.job_id))
      and p.outcome is null and p.done_at is null and p.absent_at is null and not p.excused
    returning p.user_id
  )
  select array_agg(user_id) into holders from covered;
  insert into public.events (house_id, kind, user_id, assignment_id, data)
  values (a.house_id, 'covered', me, a.id,
          jsonb_build_object('name', a.name, 'points', a.points, 'photo', photo is not null, 'for', a.user_id,
                             'for_all', to_jsonb(holders)));
end;
$$;

create or replace function public.undo_cover(p_assignment uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  a public.assignments;
begin
  select * into a from public.assignments where id = p_assignment for update;
  if a.id is null or a.covered_by is distinct from me then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  if a.outcome is not null then
    raise exception 'already_settled';
  end if;
  if exists (
    select 1 from public.disputes d join public.assignments p on p.id = d.assignment_id
    where d.resolution is null and (p.id = a.id or (a.job_id is not null and p.job_id = a.job_id))
  ) then
    raise exception 'under_dispute';
  end if;
  update public.assignments p set done_at = null, photo_path = null, covered_by = null
  where (p.id = a.id or (a.job_id is not null and p.job_id = a.job_id))
    and p.outcome is null and p.covered_by = me and p.done_at = a.done_at;
  delete from public.events
  where assignment_id = a.id and kind = 'covered' and created_at >= a.done_at;
end;
$$;

-- --- The housemate check -------------------------------------------------------------

-- The place a tick is checked on: for a roll call, the place it was ticked
-- from; for a cover of a Together John, its first covered place; otherwise
-- the place itself. So a job has one check, whichever place it's raised on.
create function public.checked_place(a public.assignments)
returns uuid
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(
    (select c.assignment_id from public.crew c where c.job_id = coalesce(a.job_id, a.id) limit 1),
    (select p.id from public.assignments p
     where a.job_id is not null and p.job_id = a.job_id and p.done_at = a.done_at
     order by p.id limit 1),
    a.id
  )
$$;

create or replace function public.raise_dispute(p_assignment uuid, p_reason text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  a public.assignments;
  h public.houses;
  checked uuid;
  dispute uuid;
begin
  select * into a from public.assignments where id = p_assignment;
  if a.id is null or not public.is_member(a.house_id) then
    raise exception 'not_in_house' using errcode = '42501';
  end if;
  checked := public.checked_place(a);
  select * into a from public.assignments where id = checked for update;
  if coalesce(a.covered_by, a.user_id) = me then
    raise exception 'own_john' using errcode = '42501';
  end if;
  select * into h from public.houses where id = a.house_id;
  if a.done_at is null or a.outcome is not null
     or now() >= a.done_at + make_interval(hours => h.dispute_hours) then
    raise exception 'not_disputable';
  end if;
  insert into public.disputes (assignment_id, house_id, raised_by, reason, tick_at, closes_at)
  values (a.id, a.house_id, me, btrim(p_reason), a.done_at,
          now() + make_interval(hours => greatest(h.dispute_hours, 12)))
  returning id into dispute;
  insert into public.dispute_votes (dispute_id, user_id, uphold) values (dispute, me, true);
  insert into public.events (house_id, kind, user_id, assignment_id, data)
  values (a.house_id, 'disputed', me, a.id,
          jsonb_build_object('name', a.name, 'against', coalesce(a.covered_by, a.user_id), 'reason', btrim(p_reason)));
  return dispute;
exception
  when unique_violation then
    raise exception 'already_disputed';
end;
$$;

-- Upheld strikes the tick: every place it settled opens again (a roll call's
-- absences too), and the roll call's crew goes.
create or replace function public.resolve_dispute(p_dispute uuid, p_resolution text)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  d public.disputes;
  a public.assignments;
begin
  update public.disputes set resolution = p_resolution, resolved_at = now()
  where id = p_dispute and resolution is null
  returning * into d;
  if d.id is null then
    return false;
  end if;
  select * into a from public.assignments where id = d.assignment_id;
  if p_resolution = 'upheld' then
    update public.assignments p set done_at = null, photo_path = null, covered_by = null, absent_at = null
    where (p.id = d.assignment_id or (a.job_id is not null and p.job_id = a.job_id))
      and p.outcome is null and (p.done_at = d.tick_at or p.absent_at = d.tick_at);
    delete from public.crew where assignment_id = d.assignment_id and created_at = d.tick_at;
  end if;
  insert into public.events (house_id, kind, assignment_id, data)
  values (d.house_id, p_resolution, d.assignment_id,
          jsonb_build_object('name', a.name, 'against', coalesce(a.covered_by, a.user_id)));
  return true;
end;
$$;

-- --- Settling -----------------------------------------------------------------------

-- As before, and a no-show's forfeit names who did the job.
create or replace function public.settle_assignments(p_items jsonb)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  x jsonb;
  a public.assignments;
  n integer := 0;
begin
  for x in select * from jsonb_array_elements(p_items) loop
    update public.assignments
    set outcome = x ->> 'outcome', settled_at = now()
    where id = (x ->> 'id')::uuid and outcome is null
    returning * into a;
    if a.id is null then
      continue;
    end if;
    n := n + 1;
    if coalesce((x ->> 'forfeit')::integer, 0) > 0 then
      insert into public.ledger (house_id, user_id, kind, amount_minor, month, assignment_id, counterparty, doers)
      values (a.house_id, a.user_id, 'forfeit', -(x ->> 'forfeit')::integer, x ->> 'month', a.id,
              case when a.outcome = 'covered' then a.covered_by end,
              case when a.absent_at is not null then (
                select array_agg(c.user_id order by c.user_id) from public.crew c where c.job_id = a.job_id
              ) end)
      on conflict do nothing;
    end if;
    if a.outcome = 'missed' then
      insert into public.events (house_id, kind, user_id, assignment_id, data)
      values (a.house_id, 'missed', a.user_id, a.id, jsonb_build_object('name', a.name));
    end if;
    a := null;
  end loop;
  return n;
end;
$$;

-- Work done, over every week: a place counts for whoever covered it, for
-- nobody when it was missed or its holder was left off a roll call, for the
-- roll call's crew (what each earned) when its holder is on one, otherwise
-- for its holder. Mirrors @app/core crew.ts creditRows.
create or replace function public.house_balances(p_house uuid, p_before date)
returns table (user_id uuid, owed numeric, credited numeric)
language sql
stable
security invoker set search_path = ''
as $$
  with past as (
    select w.id from public.weeks w
    where w.house_id = p_house and w.starts_on < p_before and w.skipped_at is null
  ),
  owed as (
    select s.user_id, sum(s.share) as owed
    from public.week_shares s
    where s.week_id in (select id from past)
    group by s.user_id
  ),
  work as (
    select coalesce(a.covered_by, a.user_id) as user_id, a.points::numeric as points
    from public.assignments a
    where a.week_id in (select id from past)
      and (a.covered_by is not null or a.outcome is distinct from 'missed')
      and a.absent_at is null
      and not exists (
        select 1 from public.crew c where c.job_id = coalesce(a.job_id, a.id) and c.user_id = a.user_id
      )
    union all
    select c.user_id, c.points
    from public.crew c
    join public.assignments a on a.id = c.assignment_id
    where a.week_id in (select id from past)
  ),
  credited as (
    select w.user_id, sum(w.points) as credited from work w group by w.user_id
  )
  select coalesce(o.user_id, c.user_id), coalesce(o.owed, 0), coalesce(c.credited, 0)
  from owed o
  full join credited c on c.user_id = o.user_id;
$$;

-- --- Dealing -------------------------------------------------------------------------

-- As before (20261030090000_why_dealt.sql), keeping each place's job_id.
create or replace function public.deal_week(
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
      where week_id = week
        and (done_at is not null or absent_at is not null or outcome is not null or flagged_at is not null)
    ) then
      raise exception 'week_started';
    end if;
    delete from public.assignments where week_id = week;
    delete from public.week_shares where week_id = week;
    delete from public.on_call where week_id = week;
  end if;

  insert into public.assignments
    (week_id, house_id, john_id, user_id, name, category, points, needs_photo, due_at, group_name, dealt, job_id)
  select week, p_house, (x ->> 'john_id')::uuid, (x ->> 'user_id')::uuid, x ->> 'name',
         x ->> 'category', (x ->> 'points')::smallint, coalesce((x ->> 'needs_photo')::boolean, false),
         (x ->> 'due_at')::timestamptz, x ->> 'group_name', x -> 'dealt', (x ->> 'job_id')::uuid
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

-- --- Swaps and time away -------------------------------------------------------------

-- As before, but a swap never gives anyone two places in one job.
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
     or theirs.absent_at is not null or mine.flagged_at is not null or theirs.flagged_at is not null then
    raise exception 'not_swappable';
  end if;
  if (mine.job_id is not null and exists (
        select 1 from public.assignments where job_id = mine.job_id and user_id = theirs.user_id))
     or (theirs.job_id is not null and exists (
        select 1 from public.assignments where job_id = theirs.job_id and user_id = mine.user_id)) then
    raise exception 'same_job';
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

-- As before (20261029090000_fair_rules.sql), except a place in a Together
-- John is never pulled forward: it's done with the others when it's due. It
-- goes to whoever shares it, is home, holds no place in it and has been
-- handed least this week; with nobody, it is excused.
create or replace function public.set_away(p_starts date, p_ends date, p_note text default null)
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

-- --- Keeping a job whole -------------------------------------------------------------

-- A roll call is one tick. However the tick on the place it was ticked from
-- is taken back (undo_done, History's undo_action, an admin's reset), every
-- place it settled opens again and its crew goes; a cover of a job taken
-- back opens all the places it covered. A forfeit those places were settled
-- with goes too while its month is open, as undo_action does for the place
-- itself (a month already shared out keeps its money). The functions here
-- do the same themselves, so for them this finds nothing left to do.
--
-- A single place leaving its roll call (a reset puts one person's Johns
-- back to open, or changes one result) takes its points out of the share,
-- and its holder off the crew: the rest share what is left.
create function public.job_follows()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  tick timestamptz := old.done_at;
  n integer;
begin
  if old.covered_by is not null then
    -- A cover of a job taken back: the rest of what it covered opens again.
    if old.job_id is null then
      return null;
    end if;
    delete from public.ledger l
    using public.assignments p
    where l.assignment_id = p.id and l.kind = 'forfeit'
      and p.job_id = old.job_id and p.id <> old.id
      and p.covered_by = old.covered_by and p.done_at = tick
      and public.month_open(p.house_id, p.due_at);
    update public.assignments p
    set done_at = null, photo_path = null, covered_by = null, outcome = null, settled_at = null
    where p.job_id = old.job_id and p.id <> old.id
      and p.covered_by = old.covered_by and p.done_at = tick;
    return null;
  end if;

  if exists (select 1 from public.crew where assignment_id = old.id and created_at = tick) then
    -- The place it was ticked from: the whole roll call goes.
    delete from public.crew where assignment_id = old.id and created_at = tick;
    if old.job_id is not null then
      delete from public.ledger l
      using public.assignments p
      where l.assignment_id = p.id and l.kind = 'forfeit'
        and p.job_id = old.job_id and p.id <> old.id and p.covered_by is null
        and (p.done_at = tick or p.absent_at = tick)
        and public.month_open(p.house_id, p.due_at);
      update public.assignments p
      set done_at = null, photo_path = null, absent_at = null, outcome = null, settled_at = null
      where p.job_id = old.job_id and p.id <> old.id and p.covered_by is null
        and (p.done_at = tick or p.absent_at = tick);
    end if;
    return null;
  end if;

  -- Someone on a roll call whose own place opened again: off the crew, and
  -- their place's points out of the share.
  select count(*) into n from public.crew where job_id = coalesce(old.job_id, old.id) and created_at = tick;
  if n > 0 and exists (
    select 1 from public.crew where job_id = coalesce(old.job_id, old.id) and created_at = tick and user_id = old.user_id
  ) then
    delete from public.crew where job_id = coalesce(old.job_id, old.id) and created_at = tick and user_id = old.user_id;
    if n > 1 then
      update public.crew
      set points = greatest(points * n - old.points, 0) / (n - 1)
      where job_id = coalesce(old.job_id, old.id) and created_at = tick;
    end if;
  end if;
  return null;
end;
$$;

create trigger job_follows
  after update of done_at, covered_by on public.assignments
  for each row
  when (old.done_at is not null and new.done_at is distinct from old.done_at)
  execute function public.job_follows();

-- A place left off that is then settled some other way (an admin's result,
-- a skipped week, a cover) or put back to open is no longer left off, and
-- its points come out of the share.
create function public.left_off_settled()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  n integer;
begin
  new.absent_at := null;
  select count(*) into n from public.crew where job_id = old.job_id and created_at = old.absent_at;
  if n > 0 then
    update public.crew
    set points = greatest(points - old.points::numeric / n, 0)
    where job_id = old.job_id and created_at = old.absent_at;
  end if;
  return new;
end;
$$;

create trigger left_off_settled
  before update on public.assignments
  for each row
  when (
    old.absent_at is not null and new.absent_at is not null
    and (new.done_at is not null or new.excused or new.covered_by is not null
         or (old.outcome is not null and new.outcome is null)
         or new.outcome in ('done', 'late', 'excused'))
  )
  execute function public.left_off_settled();

revoke execute on function public.job_follows(), public.left_off_settled() from public, anon, authenticated;

-- --- Grants ------------------------------------------------------------------------------

-- Replacing a function keeps its grants; said again here so this file stands alone.
revoke execute on function
  public.my_open_assignment(uuid), public.mark_done(uuid, text), public.roll_call(uuid, uuid[], text),
  public.undo_done(uuid), public.cover_john(uuid, text), public.undo_cover(uuid),
  public.checked_place(public.assignments), public.raise_dispute(uuid, text),
  public.resolve_dispute(uuid, text), public.settle_assignments(jsonb),
  public.deal_week(uuid, date, timestamptz, timestamptz, jsonb, jsonb, boolean, jsonb),
  public.use_swap(uuid, uuid), public.set_away(date, date, text)
from public, anon, authenticated;
revoke execute on function public.house_balances(uuid, date) from public, anon;
grant execute on function
  public.mark_done(uuid, text), public.roll_call(uuid, uuid[], text), public.undo_done(uuid),
  public.cover_john(uuid, text), public.undo_cover(uuid), public.raise_dispute(uuid, text),
  public.use_swap(uuid, uuid), public.set_away(date, date, text), public.house_balances(uuid, date)
to authenticated, service_role;
grant execute on function
  public.my_open_assignment(uuid), public.checked_place(public.assignments),
  public.resolve_dispute(uuid, text), public.settle_assignments(jsonb),
  public.deal_week(uuid, date, timestamptz, timestamptz, jsonb, jsonb, boolean, jsonb)
to service_role;
