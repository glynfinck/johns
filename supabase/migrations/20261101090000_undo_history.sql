-- Undo and History: one record of what each person did in the house, and
-- one way to take any of it back.
--
-- house_actions is written by triggers, not by the functions themselves, so
-- every move (mark_done, cover_john, raise_flag, use_swap, use_immunity,
-- raise_dispute, cast_vote, confirm_payment, set_away, set_member_role,
-- remove_member) is recorded however it is reached, and the functions stay
-- as they are. A row is recorded only when a person acted (auth.uid() is
-- set): the engine's own writes are not undoable moves.
--
-- Who can undo, and how far back (docs/specs/undo-history.md):
--   own    whoever did it, until it settles: a tick until it stands or its
--          John closes, the rest while it is still open (the week, the
--          dispute, seven days for a payment);
--   admin  any admin, anyone's, until the month it belongs to is shared
--          out. A settled tick goes back to open and the engine settles it
--          again (missed, if its John has closed).
-- After a month is shared out nothing in it is undone; that is a correction
-- (resets, a later change).
--
-- When an admin undoes someone else's move, the Wall tells them ('undone'),
-- so admin power stays visible.

-- --- The record ------------------------------------------------------------------------

create table public.house_actions (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  -- Who did it.
  actor uuid references public.profiles (id) on delete set null,
  -- Whose John, money or role it touched (the actor's own, often).
  subject uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in (
    'tick', 'cover', 'flag', 'swap', 'immunity', 'dispute', 'vote', 'payment', 'away', 'role', 'remove'
  )),
  -- The John it was about, when there was one. Kept when undoing a flag
  -- deletes its assignment: the name is in data.
  assignment_id uuid references public.assignments (id) on delete set null,
  -- The other row it made or changed: the dispute, the time away, or for a
  -- swap the John given away.
  ref uuid,
  -- What undoing it needs, and the words History shows (name, ...).
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by uuid references public.profiles (id) on delete set null
);

create index house_actions_house on public.house_actions (house_id, created_at desc);
create index house_actions_mine on public.house_actions (actor, created_at desc) where undone_at is null;

alter table public.house_actions enable row level security;
create policy "members see the house's history" on public.house_actions
  for select to authenticated using (public.is_member(house_id));

revoke all on public.house_actions from anon, authenticated;
grant select on public.house_actions to authenticated;
grant select, insert, update, delete on public.house_actions to service_role;

-- 'undone' on the Wall. The list of kinds is read from the live constraint
-- and added to, so a migration that sorts before this one never loses its kinds.
do $$
declare
  def text;
begin
  select pg_get_constraintdef(oid) into def
  from pg_catalog.pg_constraint
  where conrelid = 'public.events'::regclass and conname = 'events_kind_check';
  if def is null or def like '%''undone''%' then
    return;
  end if;
  execute 'alter table public.events drop constraint events_kind_check';
  execute 'alter table public.events add constraint events_kind_check '
    || replace(def, 'ARRAY[', 'ARRAY[''undone''::text, ');
end;
$$;

-- --- Recording ---------------------------------------------------------------------------

-- Set while undo_action runs, so putting something back is not itself recorded.
create function public.recording()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) is not null and coalesce(current_setting('johns.undoing', true), '') <> 'on';
$$;

-- Most moves already write a Wall event; each of those kinds is one action.
create function public.record_event_action()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  a public.assignments;
  j public.johns;
  sharers uuid[];
  other uuid;
begin
  if not public.recording() then
    return null;
  end if;
  if new.kind in ('done', 'late') then
    select * into a from public.assignments where id = new.assignment_id;
    insert into public.house_actions (house_id, actor, subject, kind, assignment_id, data)
    values (new.house_id, me, new.user_id, 'tick', new.assignment_id,
            jsonb_build_object('name', a.name, 'done_at', a.done_at, 'late', new.kind = 'late', 'event', new.id));
  elsif new.kind = 'covered' then
    select * into a from public.assignments where id = new.assignment_id;
    insert into public.house_actions (house_id, actor, subject, kind, assignment_id, data)
    values (new.house_id, me, a.user_id, 'cover', new.assignment_id,
            jsonb_build_object('name', a.name, 'done_at', a.done_at, 'event', new.id));
  elsif new.kind = 'flagged' then
    -- Who shared the flag's points when it was raised, as open_flag counted
    -- them, so undoing it can take them back off.
    select * into a from public.assignments where id = new.assignment_id;
    select * into j from public.johns where id = a.john_id;
    select coalesce(array_agg(gm.user_id), '{}') into sharers
    from public.group_members gm where gm.group_id = j.group_id and gm.house_id = j.house_id;
    if j.group_id is null or cardinality(sharers) = 0 then
      select array_agg(m.user_id) into sharers from public.members m where m.house_id = new.house_id;
    end if;
    insert into public.house_actions (house_id, actor, subject, kind, assignment_id, data)
    values (new.house_id, me, new.user_id, 'flag', new.assignment_id,
            jsonb_build_object('name', a.name, 'points', a.points, 'sharers', to_jsonb(sharers)));
  elsif new.kind = 'swap_used' then
    -- new.assignment_id is the John taken; the one given away now belongs
    -- to whoever it was taken from.
    select x.id into other from public.assignments x
    join public.assignments t on t.id = new.assignment_id
    where x.week_id = t.week_id and x.user_id = (new.data ->> 'with')::uuid
      and x.name = new.data ->> 'gave' and x.done_at is null and x.outcome is null
    order by x.due_at limit 1;
    insert into public.house_actions (house_id, actor, subject, kind, assignment_id, ref, data)
    values (new.house_id, me, (new.data ->> 'with')::uuid, 'swap', new.assignment_id, other,
            jsonb_build_object('name', new.data ->> 'took', 'gave', new.data ->> 'gave', 'event', new.id));
  elsif new.kind = 'immunity_used' then
    insert into public.house_actions (house_id, actor, subject, kind, assignment_id, data)
    values (new.house_id, me, new.user_id, 'immunity', new.assignment_id,
            jsonb_build_object('name', new.data ->> 'name', 'event', new.id));
  elsif new.kind = 'disputed' then
    insert into public.house_actions (house_id, actor, subject, kind, assignment_id, ref, data)
    select new.house_id, me, (new.data ->> 'against')::uuid, 'dispute', new.assignment_id, d.id,
           jsonb_build_object('name', new.data ->> 'name', 'event', new.id)
    from public.disputes d
    where d.assignment_id = new.assignment_id and d.resolution is null;
  elsif new.kind = 'paid' then
    -- Both halves of the payment were written in this same call.
    insert into public.house_actions (house_id, actor, subject, kind, data)
    select new.house_id, me, new.user_id, 'payment',
           jsonb_build_object('amount', (new.data ->> 'amount')::integer, 'event', new.id,
                              'ledger', coalesce(jsonb_agg(l.id), '[]'::jsonb))
    from public.ledger l
    where l.house_id = new.house_id and l.kind = 'payment' and l.created_at = new.created_at
      and ((l.user_id = new.user_id and l.counterparty = me) or (l.user_id = me and l.counterparty = new.user_id));
  elsif new.kind = 'away' then
    insert into public.house_actions (house_id, actor, subject, kind, ref, data)
    values (new.house_id, me, new.user_id, 'away', (new.data ->> 'away')::uuid,
            jsonb_build_object('starts_on', new.data ->> 'starts_on', 'ends_on', new.data ->> 'ends_on'));
  end if;
  return null;
end;
$$;

create trigger record_event_action
  after insert on public.events
  for each row
  when (new.kind in ('done', 'late', 'covered', 'flagged', 'swap_used', 'immunity_used', 'disputed', 'paid', 'away'))
  execute function public.record_event_action();

-- A vote, but not the one raising a dispute casts: that is the dispute.
create function public.record_vote_action()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  d public.disputes;
  a public.assignments;
begin
  if not public.recording() then
    return null;
  end if;
  select * into d from public.disputes where id = new.dispute_id;
  if d.raised_by = new.user_id then
    return null;
  end if;
  select * into a from public.assignments where id = d.assignment_id;
  insert into public.house_actions (house_id, actor, subject, kind, assignment_id, ref, data)
  values (d.house_id, new.user_id, coalesce(a.covered_by, a.user_id), 'vote', a.id, d.id,
          jsonb_build_object('name', a.name, 'uphold', new.uphold));
  return null;
end;
$$;

create trigger record_vote_action
  after insert or update of uphold on public.dispute_votes
  for each row execute function public.record_vote_action();

-- Making or unmaking an admin, and an admin removing someone. Leaving
-- yourself isn't recorded: you rejoin with the code instead.
create function public.record_member_action()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not public.recording() then
    return null;
  end if;
  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      insert into public.house_actions (house_id, actor, subject, kind, data)
      values (new.house_id, me, new.user_id, 'role', jsonb_build_object('from', old.role, 'to', new.role));
    end if;
  elsif old.user_id <> me and exists (select 1 from public.houses where id = old.house_id) then
    insert into public.house_actions (house_id, actor, subject, kind, data)
    values (old.house_id, me, old.user_id, 'remove', jsonb_build_object(
      'role', old.role, 'joined_at', old.joined_at, 'streak', old.streak,
      'immunity_tokens', old.immunity_tokens, 'swap_tokens', old.swap_tokens));
  end if;
  return null;
end;
$$;

create trigger record_member_action
  after update of role or delete on public.members
  for each row execute function public.record_member_action();

-- --- How far an undo reaches -------------------------------------------------------------

-- Whether the month a moment falls in (in the house's zone) is still open:
-- its Stake not yet shared out.
create function public.month_open(p_house uuid, p_at timestamptz)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select not exists (
    select 1 from public.month_closes c join public.houses h on h.id = c.house_id
    where c.house_id = p_house and c.month = to_char(p_at at time zone h.timezone, 'YYYY-MM')
  );
$$;

-- Who may undo this now: 'own' (whoever did it, while it is open), 'admin'
-- (an admin, until its month is shared out), or null (nobody: it's already
-- undone, has moved on, or is past reach). Undoing checks this again.
create function public.undo_reach(x public.house_actions)
returns text
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  mine boolean;
  admin boolean;
  a public.assignments;
  b public.assignments;
  w public.weeks;
  d public.disputes;
  aw public.away;
  tz text;
  open_dispute boolean;
  month_ok boolean;
begin
  if me is null or x.undone_at is not null or not public.is_member(x.house_id) then
    return null;
  end if;
  mine := x.actor = me;
  admin := public.is_admin(x.house_id);
  select timezone into tz from public.houses where id = x.house_id;

  if x.kind in ('tick', 'cover', 'flag', 'swap', 'immunity') then
    select * into a from public.assignments where id = x.assignment_id;
    if a.id is null then
      return null;
    end if;
    select * into w from public.weeks where id = a.week_id;
    open_dispute := exists (select 1 from public.disputes where assignment_id = a.id and resolution is null);
    month_ok := public.month_open(x.house_id, a.due_at)
      and not exists (
        select 1 from public.ledger l join public.month_closes c on c.house_id = l.house_id and c.month = l.month
        where l.assignment_id = a.id and l.kind = 'forfeit'
      );
  end if;

  case x.kind
  when 'tick' then
    -- Still this tick (not struck and ticked again), not under dispute, not covered.
    if a.done_at is distinct from (x.data ->> 'done_at')::timestamptz or a.covered_by is not null or open_dispute then
      return null;
    end if;
    if mine and a.user_id = me and a.outcome is null and now() < public.closes_at(a, w.ends_at) then
      return 'own';
    end if;
    return case when admin and month_ok then 'admin' end;
  when 'cover' then
    if a.done_at is distinct from (x.data ->> 'done_at')::timestamptz or a.covered_by is distinct from x.actor
       or open_dispute then
      return null;
    end if;
    if mine and a.outcome is null then
      return 'own';
    end if;
    return case when admin and month_ok then 'admin' end;
  when 'flag' then
    if a.done_at is not null or a.outcome is not null then
      return null;
    end if;
    return case when mine then 'own' when admin then 'admin' end;
  when 'swap' then
    select * into b from public.assignments where id = x.ref;
    if b.id is null or a.user_id is distinct from x.actor or b.user_id is distinct from x.subject
       or a.done_at is not null or b.done_at is not null or a.outcome is not null or b.outcome is not null
       or now() >= w.ends_at then
      return null;
    end if;
    return case when mine then 'own' when admin then 'admin' end;
  when 'immunity' then
    if a.outcome is distinct from 'excused' then
      return null;
    end if;
    if mine and w.closed_at is null then
      return 'own';
    end if;
    return case when admin and month_ok then 'admin' end;
  when 'dispute' then
    select * into d from public.disputes where id = x.ref;
    if d.id is null or d.resolution is not null then
      return null;
    end if;
    if mine and not exists (select 1 from public.dispute_votes v where v.dispute_id = d.id and v.user_id <> me) then
      return 'own';
    end if;
    return case when admin then 'admin' end;
  when 'vote' then
    select * into d from public.disputes where id = x.ref;
    if d.id is null or d.resolution is not null or now() >= d.closes_at
       or not exists (select 1 from public.dispute_votes v where v.dispute_id = d.id and v.user_id = x.actor) then
      return null;
    end if;
    return case when mine then 'own' end;
  when 'payment' then
    if not exists (
      select 1 from public.ledger l where l.id in (select (jsonb_array_elements_text(x.data -> 'ledger'))::bigint)
    ) then
      return null;
    end if;
    if mine and now() < x.created_at + interval '7 days' then
      return 'own';
    end if;
    return case when admin and public.month_open(x.house_id, x.created_at) then 'admin' end;
  when 'away' then
    select * into aw from public.away where id = x.ref;
    if aw.id is null or aw.ends_on < (now() at time zone tz)::date then
      return null;
    end if;
    return case when mine then 'own' when admin then 'admin' end;
  when 'role' then
    if not exists (
      select 1 from public.members where house_id = x.house_id and user_id = x.subject and role = x.data ->> 'to'
    ) then
      return null;
    end if;
    return case when admin and public.month_open(x.house_id, x.created_at) then 'admin' end;
  when 'remove' then
    if now() >= x.created_at + interval '7 days'
       or exists (select 1 from public.members where user_id = x.subject) then
      return null;
    end if;
    return case when admin then 'admin' end;
  else
    return null;
  end case;
end;
$$;

-- --- Undoing -----------------------------------------------------------------------------

-- Take an action back, if undo_reach allows it. Each kind puts back what
-- its move changed and takes its Wall post away; an admin undoing someone
-- else's leaves an 'undone' post for them instead.
create function public.undo_action(p_action uuid)
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

  -- An admin taking back someone else's move says so on the Wall, to them.
  if x.actor is not null and x.actor <> me then
    insert into public.events (house_id, kind, user_id, assignment_id, data)
    values (x.house_id, 'undone', x.actor,
            case when x.kind = 'flag' then null else x.assignment_id end,
            jsonb_build_object('by', me, 'what', x.kind, 'name', x.data ->> 'name', 'action', x.id));
  end if;
end;
$$;

-- The toast's Undo: take back your latest action of this kind about this
-- John (or dispute, or housemate; with none, your latest of the kind),
-- whatever its id.
create function public.undo_latest(p_kind text, p_about uuid default null)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  found_id uuid;
begin
  select id into found_id from public.house_actions
  where actor = me and kind = p_kind and undone_at is null
    and (p_about is null or assignment_id = p_about or ref = p_about or subject = p_about)
  order by created_at desc limit 1;
  if found_id is null then
    raise exception 'cannot_undo';
  end if;
  perform public.undo_action(found_id);
  return found_id;
end;
$$;

-- History, newest first, with who may undo each one now.
create function public.house_history(p_house uuid, p_before timestamptz default null, p_limit integer default 60)
returns table (
  id uuid, kind text, actor uuid, subject uuid, assignment_id uuid, ref uuid, data jsonb,
  created_at timestamptz, undone_at timestamptz, undone_by uuid, reach text
)
language sql
stable
security definer set search_path = ''
as $$
  select x.id, x.kind, x.actor, x.subject, x.assignment_id, x.ref, x.data, x.created_at, x.undone_at, x.undone_by,
         public.undo_reach(x)
  from public.house_actions x
  where x.house_id = p_house and public.is_member(p_house)
    and (p_before is null or x.created_at < p_before)
  order by x.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;

revoke execute on function
  public.recording(), public.record_event_action(), public.record_vote_action(),
  public.record_member_action(), public.month_open(uuid, timestamptz),
  public.undo_reach(public.house_actions), public.undo_action(uuid), public.undo_latest(text, uuid),
  public.house_history(uuid, timestamptz, integer)
from public, anon, authenticated;
grant execute on function
  public.undo_action(uuid), public.undo_latest(text, uuid), public.house_history(uuid, timestamptz, integer)
to authenticated;
grant execute on function
  public.recording(), public.record_event_action(), public.record_vote_action(),
  public.record_member_action(), public.month_open(uuid, timestamptz),
  public.undo_reach(public.house_actions), public.undo_action(uuid), public.undo_latest(text, uuid),
  public.house_history(uuid, timestamptz, integer)
to service_role;
