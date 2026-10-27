-- Covering someone else's John.
--
-- When a John is left undone (the bins are still out at midnight) and a
-- housemate does it instead, that is now on the record. Once a John is past
-- its due time by the house's grace period (houses.cover_grace_hours,
-- default 3) and nobody has ticked it, anyone else in the house can cover
-- it: cover_john ticks it in their name and sets assignments.covered_by.
-- Until then it is still the assignee's to do, and they can tick it late
-- right up until someone covers it; the first tick wins.
--
-- A cover is checked like any tick: it stands after the dispute window, the
-- assignee (or anyone but the coverer) can dispute it, and upheld strikes it
-- and opens the John again. When it stands it settles as 'covered': the
-- assignee is treated as having missed it (no points, the missed forfeit, a
-- broken streak), the coverer earns its points, and the forfeit is written
-- with the coverer as its counterparty so that month close pays it to them
-- instead of sharing it round the house (@app/core stake.ts settleMonth).
--
-- The condition is "unsettled and past due plus grace", not "week still
-- open", so a John that outlives its week until the clock settles it can
-- still be covered.

alter table public.houses add column cover_grace_hours smallint not null default 3
  check (cover_grace_hours between 0 and 48);
grant update (cover_grace_hours) on public.houses to authenticated;

alter table public.assignments add column covered_by uuid references public.profiles (id) on delete set null;
alter table public.assignments add constraint assignments_cover_shape
  check (covered_by is null or (done_at is not null and covered_by <> user_id));

alter table public.assignments drop constraint assignments_outcome_check;
alter table public.assignments add constraint assignments_outcome_check
  check (outcome in ('done', 'late', 'missed', 'excused', 'covered'));

create index assignments_covered_by on public.assignments (covered_by) where covered_by is not null;

-- 'flagged' is on-call Johns' kind (20261027200000_on_call_johns); it is
-- listed here too so that whichever of the two lands second keeps both.
alter table public.events drop constraint events_kind_check;
alter table public.events add constraint events_kind_check check (kind in (
  'joined', 'done', 'late', 'missed', 'disputed', 'upheld', 'rejected',
  'immunity_earned', 'immunity_used', 'swap_earned', 'swap_used',
  'week_dealt', 'month_closed', 'paid', 'away', 'flagged', 'covered'
));

-- --- Covering ----------------------------------------------------------------------

create function public.cover_john(p_assignment uuid, p_photo_path text default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  a public.assignments;
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
  select cover_grace_hours into grace from public.houses where id = a.house_id;
  if now() < a.due_at + make_interval(hours => grace) then
    raise exception 'too_soon_to_cover';
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

-- Take a cover back while it is still being checked and nobody disputes it.
create function public.undo_cover(p_assignment uuid)
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
  if exists (select 1 from public.disputes where assignment_id = a.id and resolution is null) then
    raise exception 'under_dispute';
  end if;
  update public.assignments set done_at = null, photo_path = null, covered_by = null where id = a.id;
  delete from public.events
  where assignment_id = a.id and kind = 'covered' and created_at >= a.done_at;
end;
$$;

-- --- What changes for the functions that already were ------------------------------

-- The assignee can't undo a housemate's cover; they dispute it instead.
create or replace function public.undo_done(p_assignment uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  a public.assignments := public.my_open_assignment(p_assignment);
begin
  if a.done_at is null then
    return;
  end if;
  if a.covered_by is not null then
    raise exception 'john_covered';
  end if;
  if exists (select 1 from public.disputes where assignment_id = a.id and resolution is null) then
    raise exception 'under_dispute';
  end if;
  update public.assignments set done_at = null, photo_path = null where id = a.id;
  delete from public.events
  where assignment_id = a.id and kind in ('done', 'late') and created_at >= a.done_at;
end;
$$;

-- Whose tick it is: the coverer's when covered, else the assignee's. They
-- can't dispute it or vote on it; everyone else can, the assignee included.
create or replace function public.raise_dispute(p_assignment uuid, p_reason text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  a public.assignments;
  h public.houses;
  dispute uuid;
begin
  select * into a from public.assignments where id = p_assignment for update;
  if a.id is null or not public.is_member(a.house_id) then
    raise exception 'not_in_house' using errcode = '42501';
  end if;
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

create or replace function public.cast_vote(p_dispute uuid, p_uphold boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  d public.disputes;
  ticker uuid;
begin
  select * into d from public.disputes where id = p_dispute;
  if d.id is null or not public.is_member(d.house_id) then
    raise exception 'not_in_house' using errcode = '42501';
  end if;
  select coalesce(covered_by, user_id) into ticker from public.assignments where id = d.assignment_id;
  if ticker = me then
    raise exception 'own_john' using errcode = '42501';
  end if;
  if d.resolution is not null or now() >= d.closes_at then
    raise exception 'vote_closed';
  end if;
  insert into public.dispute_votes (dispute_id, user_id, uphold)
  values (d.id, me, p_uphold)
  on conflict (dispute_id, user_id) do update set uphold = excluded.uphold, created_at = now();
end;
$$;

-- Upheld strikes the tick, a cover included: the John is open again.
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
    update public.assignments set done_at = null, photo_path = null, covered_by = null
    where id = d.assignment_id and done_at = d.tick_at and outcome is null;
  end if;
  insert into public.events (house_id, kind, assignment_id, data)
  values (d.house_id, p_resolution, d.assignment_id,
          jsonb_build_object('name', a.name, 'against', coalesce(a.covered_by, a.user_id)));
  return true;
end;
$$;

-- A covered John's forfeit names the coverer as its counterparty.
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
      insert into public.ledger (house_id, user_id, kind, amount_minor, month, assignment_id, counterparty)
      values (a.house_id, a.user_id, 'forfeit', -(x ->> 'forfeit')::integer, x ->> 'month', a.id,
              case when a.outcome = 'covered' then a.covered_by end)
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
          and now() >= a.due_at + make_interval(hours => (
            select h.cover_grace_hours from public.houses h where h.id = house
          ))
        )
      )
  );
end;
$$;

-- Replacing a function keeps its grants; said again here so this file stands alone.
revoke execute on function
  public.cover_john(uuid, text), public.undo_cover(uuid), public.undo_done(uuid),
  public.raise_dispute(uuid, text), public.cast_vote(uuid, boolean),
  public.resolve_dispute(uuid, text), public.settle_assignments(jsonb),
  public.can_upload_proof(text)
from public, anon, authenticated;
grant execute on function
  public.cover_john(uuid, text), public.undo_cover(uuid), public.undo_done(uuid),
  public.raise_dispute(uuid, text), public.cast_vote(uuid, boolean)
to authenticated, service_role;
grant execute on function public.can_upload_proof(text) to authenticated, service_role;
grant execute on function public.resolve_dispute(uuid, text), public.settle_assignments(jsonb) to service_role;
