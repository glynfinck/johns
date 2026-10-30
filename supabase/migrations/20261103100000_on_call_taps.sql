-- On-call taps: a Done it counts once, and taking it back leaves nothing to do.
--
-- Whoever is on call says "Done it", which raises a flag and ticks it at
-- once. Three things change:
--
-- 1. A Done it counts once. Raising a flag you'd hold yourself, on a John
--    you flagged and ticked yourself in the last 10 minutes, is refused
--    (just_done). Housemates' Needs doing is as before: flagging an open
--    flag still hands it back.
-- 2. Taking back the tick of a Done it takes its flag too (drop_own_flag),
--    whether from the toast, the John's sheet (undo_done) or History
--    (undo_action), so no open flag is left to do.
-- 3. remove_flag takes an open flag down from its sheet. Whoever raised it
--    can, and so can an admin. Whoever is on call can't take down a flag
--    someone else raised. It is the flag's undo, so it takes the flag's
--    points back off the shares and its post off the Wall, and an admin
--    taking down someone else's flag tells them.

-- --- 1. A Done it counts once ------------------------------------------------------

create or replace function public.raise_flag(p_john uuid)
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
  if exists (
    select 1 from public.assignments x
    where x.john_id = p_john and x.flagged_by = me and x.user_id = me
      and x.done_at > now() - interval '10 minutes'
  ) then
    raise exception 'just_done';
  end if;
  return public.open_flag(p_john, now(), me);
end;
$$;

-- --- 2. Taking back a Done it takes its flag too ------------------------------------

-- The flag of a Done it, once its tick is taken back: its holder raised it,
-- it's open again, and its own flag move can still be undone. Anything
-- else is left as it is.
create function public.drop_own_flag(p_assignment uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  a public.assignments;
  x public.house_actions;
begin
  select * into a from public.assignments where id = p_assignment;
  if a.id is null or a.flagged_at is null or a.flagged_by is distinct from a.user_id
     or a.done_at is not null or a.outcome is not null then
    return;
  end if;
  select * into x from public.house_actions
  where assignment_id = a.id and kind = 'flag' and undone_at is null
  order by created_at desc limit 1;
  if x.id is null or public.undo_reach(x) is null then
    return;
  end if;
  perform public.undo_action(x.id);
end;
$$;

-- As 20261102090000 has it, then the Done it's flag.
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
  perform public.drop_own_flag(a.id);
end;
$$;

-- undo_action as 20261101100000 has it, then the Done it's flag.
create or replace function public.undo_action(p_action uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  x public.house_actions;
  reach text;
  a public.assignments;
  b public.assignments;
  aw public.away;
  tz text;
  today date;
  s jsonb;
  n integer;
begin
  select * into x from public.house_actions where id = p_action for update;
  if x.id is null or not public.is_member(x.house_id) then
    raise exception 'not_in_house' using errcode = '42501';
  end if;
  -- Changes to the same people one at a time, as set_member_role does.
  perform pg_advisory_xact_lock(hashtextextended('johns.members:' || x.house_id::text, 0));
  if x.assignment_id is not null then
    select * into a from public.assignments where id = x.assignment_id for update;
  end if;
  reach := public.undo_reach(x);
  if x.undone_at is not null then
    raise exception 'already_undone';
  end if;
  if reach is null then
    raise exception 'cannot_undo';
  end if;
  perform set_config('johns.undoing', 'on', true);
  select timezone into tz from public.houses where id = x.house_id;

  case x.kind
  when 'reset' then
    perform public.undo_reset(x);
  when 'tick', 'cover' then
    -- Back to open. A forfeit it was settled with goes too; the engine
    -- settles it again from here (missed, if its John has closed).
    delete from public.ledger where assignment_id = a.id and kind = 'forfeit';
    update public.assignments
    set done_at = null, photo_path = null, covered_by = null, outcome = null, settled_at = null
    where id = a.id;
    delete from public.events
    where assignment_id = a.id and kind in ('done', 'late', 'covered') and created_at >= a.done_at;
  when 'flag' then
    n := greatest(jsonb_array_length(x.data -> 'sharers'), 1);
    for s in select * from jsonb_array_elements(x.data -> 'sharers') loop
      update public.week_shares
      set share = greatest(share - round((x.data ->> 'points')::numeric / n, 2), 0)
      where week_id = a.week_id and user_id = (s #>> '{}')::uuid;
    end loop;
    -- Its 'flagged' post goes with it.
    delete from public.assignments where id = a.id;
  when 'swap' then
    select * into b from public.assignments where id = x.ref for update;
    update public.assignments set user_id = x.actor, reminded = 0 where id = b.id;
    update public.assignments set user_id = x.subject, reminded = 0 where id = a.id;
    update public.members set swap_tokens = swap_tokens + 1
    where house_id = x.house_id and user_id = x.actor and swap_tokens < 1;
    delete from public.events where id = (x.data ->> 'event')::uuid;
  when 'immunity' then
    update public.assignments set excused = false, outcome = null, settled_at = null where id = a.id;
    update public.members set immunity_tokens = immunity_tokens + 1
    where house_id = x.house_id and user_id = a.user_id and immunity_tokens < 2;
    delete from public.events where id = (x.data ->> 'event')::uuid;
  when 'dispute' then
    delete from public.disputes where id = x.ref;
    delete from public.events where id = (x.data ->> 'event')::uuid;
  when 'vote' then
    delete from public.dispute_votes where dispute_id = x.ref and user_id = x.actor;
  when 'payment' then
    delete from public.ledger
    where house_id = x.house_id and kind = 'payment'
      and id in (select (jsonb_array_elements_text(x.data -> 'ledger'))::bigint);
    delete from public.events where id = (x.data ->> 'event')::uuid;
  when 'away' then
    -- As cancel_away, for whoever it was.
    select * into aw from public.away where id = x.ref for update;
    today := (now() at time zone tz)::date;
    update public.assignments
    set due_at = due_moved_from, due_moved_from = null, reminded = 0
    where house_id = aw.house_id and user_id = aw.user_id
      and done_at is null and outcome is null
      and due_moved_from is not null and due_moved_from > now()
      and (due_moved_from at time zone tz)::date between greatest(aw.starts_on, today) and aw.ends_on;
    if aw.starts_on >= today then
      delete from public.away where id = aw.id;
      delete from public.events where house_id = aw.house_id and kind = 'away' and data ->> 'away' = aw.id::text;
    else
      update public.away set ends_on = today - 1 where id = aw.id;
    end if;
  when 'role' then
    if x.data ->> 'from' = 'member' and not exists (
      select 1 from public.members where house_id = x.house_id and role = 'admin' and user_id <> x.subject
    ) then
      raise exception 'last_admin';
    end if;
    update public.members set role = x.data ->> 'from' where house_id = x.house_id and user_id = x.subject;
  when 'remove' then
    insert into public.members (house_id, user_id, role, joined_at, streak, immunity_tokens, swap_tokens)
    values (x.house_id, x.subject, x.data ->> 'role', (x.data ->> 'joined_at')::timestamptz,
            (x.data ->> 'streak')::smallint, (x.data ->> 'immunity_tokens')::smallint,
            (x.data ->> 'swap_tokens')::smallint);
  end case;

  update public.house_actions set undone_at = now(), undone_by = me where id = x.id;

  -- A Done it is a flag its holder raised and ticked at once. Taking the tick
  -- back takes the flag with it: nobody asked, so nothing is left to do.
  if x.kind = 'tick' then
    perform public.drop_own_flag(x.assignment_id);
  end if;

  -- An admin taking back someone else's move says so on the Wall, to them.
  if x.actor is not null and x.actor <> me then
    insert into public.events (house_id, kind, user_id, assignment_id, data)
    values (x.house_id, 'undone', x.actor,
            case when x.kind = 'flag' then null else x.assignment_id end,
            jsonb_build_object('by', me, 'what', x.kind, 'name', x.data ->> 'name', 'action', x.id));
  end if;
end;
$$;

-- --- 3. Taking a flag down -----------------------------------------------------------

-- Whoever raised an open flag, or an admin, takes it down. A flag opened
-- again after a miss was raised by nobody, so only an admin can.
create function public.remove_flag(p_assignment uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  a public.assignments;
  x public.house_actions;
  sharers uuid[];
  n integer;
begin
  select * into a from public.assignments where id = p_assignment for update;
  if a.id is null or not public.is_member(a.house_id) then
    raise exception 'not_in_house' using errcode = '42501';
  end if;
  if a.flagged_at is null then
    raise exception 'not_a_flag';
  end if;
  if a.done_at is not null or a.outcome is not null then
    raise exception 'flag_settled';
  end if;
  select * into x from public.house_actions
  where assignment_id = a.id and kind = 'flag' and undone_at is null
  order by created_at desc limit 1;
  if x.id is not null and public.undo_reach(x) is not null then
    perform public.undo_action(x.id);
    return;
  end if;
  if x.id is null and a.flagged_by is null and public.is_admin(a.house_id) then
    -- Opened again by the clock: as the flag's undo does, with today's sharers.
    sharers := public.flag_sharers(a.john_id);
    n := greatest(cardinality(sharers), 1);
    update public.week_shares
    set share = greatest(share - round(a.points::numeric / n, 2), 0)
    where week_id = a.week_id and user_id = any (sharers);
    delete from public.assignments where id = a.id;
    return;
  end if;
  raise exception 'not_your_flag' using errcode = '42501';
end;
$$;

-- Replacing a function keeps its grants; said again here so this file stands alone.
revoke execute on function
  public.raise_flag(uuid), public.undo_done(uuid), public.undo_action(uuid),
  public.drop_own_flag(uuid), public.remove_flag(uuid)
from public, anon, authenticated;
grant execute on function
  public.raise_flag(uuid), public.undo_done(uuid), public.undo_action(uuid), public.remove_flag(uuid)
to authenticated;
grant execute on function
  public.raise_flag(uuid), public.undo_done(uuid), public.undo_action(uuid),
  public.drop_own_flag(uuid), public.remove_flag(uuid)
to service_role;
