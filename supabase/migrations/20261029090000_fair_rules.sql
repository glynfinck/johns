-- Four rules that treated housemates differently for no good reason.
--
-- 1. The late window. A John due on a day used to stay open until its week
--    ended, so a Monday John had six days to be done late and a Sunday-night
--    one two hours. Now every John gets the same window after it was due
--    (houses.late_hours, a day by default), stored on the assignment as
--    closes_at when it is dealt or moved. One dealt before this keeps the old
--    rule (closes_at null: its week's end). A Sunday-night John stays open into
--    the next week, as a flag already could.
-- 2. Covering. A John opened to cover its grace after it was due
--    (cover_grace_hours), which for a Sunday 9pm John with a 3-hour grace was
--    after the week had closed: it could never be covered. It now opens at the
--    grace or halfway to when it turns missed, whichever is sooner.
-- 3. Disputes (decided by the engine, @app/core dispute.ts): striking a tick
--    takes a majority of everyone who may vote. Nothing here changes.
-- 4. Going away at short notice. Booking time away from today pulled every
--    John due while you're away to now, so it was overdue the moment you
--    booked. A John that would be due within 12 hours goes instead to whoever
--    shares it, is home, and has been handed least this week; with nobody
--    home it is excused.
--
-- The same rules live in @app/core outcome.ts (closesAt, coverOpensAt).

-- --- The late window ------------------------------------------------------------------

alter table public.houses add column late_hours smallint not null default 24
  check (late_hours between 1 and 72);
grant update (late_hours) on public.houses to authenticated;

-- When an open John due on a day turns missed. Null on a flag (its window
-- sets it) and on a John dealt before the house had a late window.
alter table public.assignments add column closes_at timestamptz;

create function public.set_closes_at()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.flagged_at is null then
    new.closes_at := new.due_at + make_interval(hours => (
      select h.late_hours from public.houses h where h.id = new.house_id
    ));
  end if;
  return new;
end;
$$;

create trigger set_closes_at
  before insert or update of due_at on public.assignments
  for each row execute function public.set_closes_at();

revoke execute on function public.set_closes_at() from public, anon, authenticated;

-- When an open John turns missed: closes_at for a John due on a day (its
-- week's end if it has none); for a flag twice its window (the week's end
-- instead, if it is overdue by then). Mirrors closesAt in @app/core outcome.ts.
create or replace function public.closes_at(a public.assignments, week_ends timestamptz)
returns timestamptz
language sql
immutable
as $$
  select case
    when a.flagged_at is null then coalesce(a.closes_at, week_ends)
    when a.due_at < week_ends then least(week_ends, a.due_at + (a.due_at - a.flagged_at))
    else a.due_at + (a.due_at - a.flagged_at)
  end
$$;

-- --- Covering --------------------------------------------------------------------------

-- When a housemate can first cover an open John: the house's grace after it
-- was due, or halfway to when it turns missed if that is sooner. Mirrors
-- coverOpensAt in @app/core outcome.ts.
create function public.cover_opens_at(a public.assignments, week_ends timestamptz, grace smallint)
returns timestamptz
language sql
immutable
as $$
  select a.due_at + least(
    make_interval(hours => grace),
    greatest(interval '0', (public.closes_at(a, week_ends) - a.due_at) / 2)
  )
$$;

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
begin
  select * into a from public.assignments where id = p_assignment for update;
  if a.id is null or not public.is_member(a.house_id) then
    raise exception 'not_in_house' using errcode = '42501';
  end if;
  if a.user_id = me then
    raise exception 'tick_it_yourself';
  end if;
  if a.outcome is not null then
    raise exception 'already_settled';
  end if;
  if a.done_at is not null or a.excused then
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
  update public.assignments set done_at = now(), photo_path = photo, covered_by = me where id = a.id;
  insert into public.events (house_id, kind, user_id, assignment_id, data)
  values (a.house_id, 'covered', me, a.id,
          jsonb_build_object('name', a.name, 'points', a.points, 'photo', photo is not null, 'for', a.user_id));
end;
$$;

-- A housemate who can cover a John can upload its photo receipt.
create or replace function public.can_upload_proof(object_name text)
returns boolean
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  parts text[] := storage.foldername(object_name);
  house uuid;
  assignment uuid;
begin
  if coalesce(array_length(parts, 1), 0) < 2 then
    return false;
  end if;
  begin
    house := parts[1]::uuid;
    assignment := parts[2]::uuid;
  exception
    when others then
      return false;
  end;
  return exists (
    select 1 from public.assignments a
    where a.id = assignment and a.house_id = house and a.outcome is null
      and (
        a.user_id = (select auth.uid())
        or (
          public.is_member(house) and a.done_at is null and not a.excused
          and now() >= public.cover_opens_at(
            a,
            (select w.ends_at from public.weeks w where w.id = a.week_id),
            (select h.cover_grace_hours from public.houses h where h.id = house)
          )
        )
      )
  );
end;
$$;

-- --- Going away at short notice -------------------------------------------------------------

-- Book time away for yourself. It can start today at the earliest: away is
-- planned, never claimed after the fact. Any John you already have that falls
-- due while you're gone is due before you go instead: by 23:59 the night
-- before. When that leaves under 12 hours to do it (you go today, or first
-- thing tomorrow), it goes instead to whoever shares it, is home that day and
-- has been handed least this week, or is excused with nobody home. Returns
-- how many Johns moved.
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

  if departure >= now() + interval '12 hours' then
    update public.assignments x
    set due_moved_from = coalesce(x.due_moved_from, x.due_at), due_at = departure, reminded = 0
    where x.house_id = h.id and x.user_id = me
      and x.done_at is null and x.outcome is null
      and (x.due_at at time zone h.timezone)::date between p_starts and p_ends
      and x.due_at > departure;
    get diagnostics moved = row_count;
  else
    for a in
      select * from public.assignments x
      where x.house_id = h.id and x.user_id = me
        and x.done_at is null and x.outcome is null and not x.excused
        and (x.due_at at time zone h.timezone)::date between p_starts and p_ends
        and x.due_at > now()
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
    moved := handed + excused;
  end if;

  insert into public.events (house_id, kind, user_id, data)
  values (h.id, 'away', me, jsonb_build_object(
    'away', away_id, 'starts_on', p_starts, 'ends_on', p_ends, 'moved', moved,
    'handed', handed, 'excused', excused));
  return moved;
end;
$$;

-- --- Grants ------------------------------------------------------------------------------

-- Replacing a function keeps its grants; said again here so this file stands alone.
revoke execute on function
  public.cover_john(uuid, text),
  public.can_upload_proof(text), public.set_away(date, date, text)
from public, anon, authenticated;
grant execute on function
  public.cover_john(uuid, text), public.set_away(date, date, text)
to authenticated, service_role;
grant execute on function public.can_upload_proof(text) to authenticated, service_role;
