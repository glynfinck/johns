-- Admins and resets: fixing a week that went wrong (docs/specs/admin-resets.md).
--
-- Six resets, each an admin's, each through admin_reset, which says what it
-- would change (the reset sheet's numbers) or makes the change:
--   result      change one John's result: done, late, missed or let off
--   person_week one person's Johns this week back to open
--   week        everyone's Johns this week back to open; flags and disputes cleared
--   redeal      as week, then the server deals it again from the list (lib/moves/resets.ts)
--   skip        the week counts for nothing: no shares, no credit, no forfeits,
--               and streaks neither grow nor break
--   letoff      a month's forfeits go
--
-- Money already shared out is never rewritten. A forfeit that goes, or
-- comes, in a month whose Stake is shared out becomes a correction in the
-- month that's open: the person gets it back (or pays it) and the rest of
-- the house pays (or gets) it between them.
--
-- Each reset is one house_actions row ('reset') holding what it changed, so
-- undo_action can put it back, for an admin, until the month closes, while
-- nobody has ticked any of it since. Streaks are counted again from the
-- closed weeks whenever a reset or its undo touches one. Tokens already
-- earned stay earned.
--
-- admin_reset is the server's (service role), which works out the house's
-- forfeits from its rules and House Pass and says who is asking. A
-- housemate's own call is hand_over, below.

-- --- Marks ------------------------------------------------------------------------------

-- Who changed a result, for the Track record's amber dot.
alter table public.assignments
  add column changed_by uuid references public.profiles (id) on delete set null,
  add column changed_at timestamptz;

alter table public.weeks
  add column skipped_at timestamptz,
  add column skipped_by uuid references public.profiles (id) on delete set null;

-- A month whose forfeits an admin let off.
create table public.month_let_offs (
  house_id uuid not null references public.houses (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  let_off_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (house_id, month)
);

alter table public.month_let_offs enable row level security;
create policy "members see let-off months" on public.month_let_offs
  for select to authenticated using (public.is_member(house_id));

revoke all on public.month_let_offs from anon, authenticated;
grant select on public.month_let_offs to authenticated;
grant select, insert, update, delete on public.month_let_offs to service_role;

-- New kinds: a ledger 'correction', a 'reset' action and its Wall post. Each
-- list is read from the live constraint and added to, as 20261101090000 does.
do $$
declare
  c record;
  def text;
begin
  for c in
    select * from (values
      ('public.ledger', 'ledger_kind_check', 'correction'),
      ('public.house_actions', 'house_actions_kind_check', 'reset'),
      ('public.events', 'events_kind_check', 'reset')
    ) as v (tbl, con, kind)
  loop
    select pg_get_constraintdef(oid) into def
    from pg_catalog.pg_constraint
    where conrelid = c.tbl::regclass and conname = c.con;
    if def is null or def like '%''' || c.kind || '''%' then
      continue;
    end if;
    execute format('alter table %s drop constraint %I', c.tbl, c.con);
    execute format('alter table %s add constraint %I ', c.tbl, c.con)
      || replace(def, 'ARRAY[', 'ARRAY[''' || c.kind || '''::text, ');
  end loop;
end;
$$;

-- --- Balances: a skipped week counts for nothing -----------------------------------------

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
  credited as (
    select coalesce(a.covered_by, a.user_id) as user_id, sum(a.points) as credited
    from public.assignments a
    where a.week_id in (select id from past)
      and (a.covered_by is not null or a.outcome is distinct from 'missed')
    group by 1
  )
  select coalesce(o.user_id, c.user_id), coalesce(o.owed, 0), coalesce(c.credited, 0)
  from owed o
  full join credited c on c.user_id = o.user_id;
$$;

revoke execute on function public.house_balances(uuid, date) from public, anon;
grant execute on function public.house_balances(uuid, date) to authenticated, service_role;

-- --- Helpers ------------------------------------------------------------------------------

-- Streaks counted again from the closed weeks, as the clock counts them
-- (lib/engine/tick.ts closeWeeks, @app/core streak.ts): clean weeks in a
-- row back from the latest, a week with nothing of yours passed over, a
-- skipped week passed over.
create function public.recount_streaks(p_house uuid)
returns void
language sql
security definer set search_path = ''
as $$
  with weeks as (
    select w.starts_on, a.user_id, coalesce(bool_and(a.outcome in ('done', 'excused')), false) as clean
    from public.weeks w
    join public.assignments a on a.week_id = w.id
    where w.house_id = p_house and w.closed_at is not null and w.skipped_at is null
    group by w.starts_on, a.user_id
  ),
  last_broken as (
    select user_id, max(starts_on) filter (where not clean) as broke from weeks group by user_id
  ),
  counted as (
    select w.user_id, count(*) filter (where b.broke is null or w.starts_on > b.broke) as streak
    from weeks w join last_broken b on b.user_id = w.user_id
    group by w.user_id
  )
  update public.members m
  set streak = least(coalesce(c.streak, 0), 32767)
  from public.members m2
  left join counted c on c.user_id = m2.user_id
  where m.house_id = p_house and m2.house_id = p_house and m2.user_id = m.user_id
    and m.streak is distinct from least(coalesce(c.streak, 0), 32767);
$$;

-- Add n to one person's field in a reset's tally.
create function public.reset_bump(acc jsonb, p_user uuid, field text, n numeric)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when p_user is null or n = 0 then acc else
    jsonb_set(acc, array[p_user::text],
      coalesce(acc -> p_user::text, '{}'::jsonb)
      || jsonb_build_object(field, coalesce((acc -> p_user::text ->> field)::numeric, 0) + n))
  end;
$$;

-- Who a John's points count for, as house_balances counts them.
create function public.credited_to(a public.assignments)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when a.covered_by is not null then a.covered_by
    when a.outcome = 'missed' then null
    else a.user_id
  end;
$$;

-- Whoever shares a flag's points, as open_flag counted them.
create function public.flag_sharers(p_john uuid)
returns uuid[]
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  j public.johns;
  sharers uuid[];
begin
  select * into j from public.johns where id = p_john;
  select coalesce(array_agg(gm.user_id), '{}') into sharers
  from public.group_members gm where gm.group_id = j.group_id and gm.house_id = j.house_id;
  if j.group_id is null or cardinality(sharers) = 0 then
    select coalesce(array_agg(m.user_id), '{}') into sharers from public.members m where m.house_id = j.house_id;
  end if;
  return sharers;
end;
$$;

-- A correction in the open month: p_user gets p_amount back (or pays it,
-- when negative), and everyone else in the house pays (or gets) it between
-- them, the odd pennies from the earliest to join. Returns the rows' ids.
create function public.add_correction(p_house uuid, p_user uuid, p_amount integer, p_month text, p_assignment uuid)
returns bigint[]
language plpgsql
security definer set search_path = ''
as $$
declare
  others uuid[];
  ids bigint[] := '{}';
  n integer;
  base integer;
  extra integer;
  i integer := 0;
  o uuid;
  lid bigint;
begin
  if p_amount = 0 then
    return ids;
  end if;
  select array_agg(user_id order by joined_at, user_id) into others
  from public.members where house_id = p_house and user_id <> p_user;
  n := coalesce(cardinality(others), 0);
  if n = 0 then
    -- A house of one keeps everything anyway.
    return ids;
  end if;
  insert into public.ledger (house_id, user_id, kind, amount_minor, month, assignment_id)
  values (p_house, p_user, 'correction', p_amount, p_month, p_assignment)
  returning ledger.id into lid;
  ids := ids || lid;
  base := abs(p_amount) / n;
  extra := abs(p_amount) - base * n;
  foreach o in array others loop
    i := i + 1;
    if base + (case when i <= extra then 1 else 0 end) = 0 then
      continue;
    end if;
    insert into public.ledger (house_id, user_id, kind, amount_minor, month, assignment_id, counterparty)
    values (p_house, o, 'correction', -sign(p_amount)::integer * (base + case when i <= extra then 1 else 0 end),
            p_month, p_assignment, p_user)
    returning ledger.id into lid;
    ids := ids || lid;
  end loop;
  return ids;
end;
$$;

-- --- The resets ---------------------------------------------------------------------------

-- What a reset would change, or (p_apply) the change. p_target:
--   result       {assignment, outcome}   outcome: done, late, missed, excused
--   person_week  {week, user}
--   week, redeal, skip  {week}
--   letoff       {month}
-- p_forfeits {late, missed}: what a late or missed John costs this house
-- now (0 without the Stake). Returns the tally the reset sheet shows:
--   {kind, week, month, people: {id: {ticks, points, forfeit}}, told,
--    reopened, past_due, flags, disputes, correction, nothing, action}
-- where points is the change to someone's balance and forfeit what they get
-- back (positive) or now owe (negative).
create function public.admin_reset(
  p_actor uuid,
  p_house uuid,
  p_kind text,
  p_target jsonb,
  p_forfeits jsonb default '{}'::jsonb,
  p_apply boolean default false
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  h public.houses;
  w public.weeks;
  a public.assignments;
  f public.ledger;
  target public.assignments;
  v_outcome text;
  lid bigint;
  month_now text;
  month_of text;
  closed boolean;
  people jsonb := '{}'::jsonb;
  told uuid[] := '{}';
  ids uuid[] := '{}';
  flag_ids uuid[] := '{}';
  added bigint[] := '{}';
  reopened integer := 0;
  past_due integer := 0;
  n_flags integer := 0;
  n_disputes integer := 0;
  correction boolean := false;
  nothing boolean;
  old_forfeit integer;
  new_forfeit integer;
  credit_before uuid;
  credit_after uuid;
  sharers uuid[];
  s uuid;
  snapshot jsonb;
  action uuid;
  event uuid;
  v_subject uuid;
  v_name text;
  v_month text;
  w_month text;
begin
  select * into h from public.houses where id = p_house;
  if h.id is null or not exists (
    select 1 from public.members where house_id = p_house and user_id = p_actor and role = 'admin'
  ) then
    raise exception 'admins_only' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('johns.members:' || p_house::text, 0));
  month_now := to_char(now() at time zone h.timezone, 'YYYY-MM');

  -- --- What it touches.
  if p_kind = 'result' then
    select * into target from public.assignments
    where id = (p_target ->> 'assignment')::uuid and house_id = p_house for update;
    if target.id is null then
      raise exception 'not_found';
    end if;
    v_outcome := p_target ->> 'outcome';
    if v_outcome is null or v_outcome not in ('done', 'late', 'missed', 'excused') then
      raise exception 'unknown_outcome' using errcode = '22023';
    end if;
    if exists (select 1 from public.disputes where assignment_id = target.id and resolution is null) then
      raise exception 'disputed';
    end if;
    select * into w from public.weeks where id = target.week_id;
    ids := array[target.id];
    v_subject := target.user_id;
    v_name := target.name;
  elsif p_kind in ('person_week', 'week', 'redeal', 'skip') then
    select * into w from public.weeks where id = (p_target ->> 'week')::uuid and house_id = p_house for update;
    if w.id is null then
      raise exception 'not_found';
    end if;
    if p_kind = 'skip' and w.skipped_at is not null then
      raise exception 'already_skipped';
    end if;
    if p_kind <> 'skip' and w.closed_at is not null then
      raise exception 'week_closed';
    end if;
    if p_kind = 'person_week' then
      v_subject := (p_target ->> 'user')::uuid;
      select array_agg(id) into ids from public.assignments
      where week_id = w.id and user_id = v_subject
        and (done_at is not null or outcome is not null or covered_by is not null);
    elsif p_kind = 'skip' then
      select array_agg(id) into ids from public.assignments where week_id = w.id;
    else
      -- Flags go; everything else ticked or settled goes back to open.
      select array_agg(id) into flag_ids from public.assignments where week_id = w.id and flagged_at is not null;
      select array_agg(id) into ids from public.assignments
      where week_id = w.id and flagged_at is null
        and (done_at is not null or outcome is not null or covered_by is not null);
    end if;
    ids := coalesce(ids, '{}');
    flag_ids := coalesce(flag_ids, '{}');
  elsif p_kind = 'letoff' then
    v_month := p_target ->> 'month';
    if v_month is null or v_month !~ '^\d{4}-\d{2}$' then
      raise exception 'unknown_month' using errcode = '22023';
    end if;
    if exists (select 1 from public.month_let_offs where house_id = p_house and month_let_offs.month = v_month) then
      raise exception 'already_let_off';
    end if;
    select coalesce(array_agg(distinct l.assignment_id) filter (where l.assignment_id is not null), '{}') into ids
    from public.ledger l where l.house_id = p_house and l.month = v_month and l.kind = 'forfeit';
  else
    raise exception 'unknown_reset' using errcode = '22023';
  end if;
  if w.id is not null then
    w_month := to_char(w.starts_at at time zone h.timezone, 'YYYY-MM');
  end if;

  -- --- The tally.
  for a in select * from public.assignments where id = any (ids) loop
    month_of := to_char(a.due_at at time zone h.timezone, 'YYYY-MM');
    closed := exists (select 1 from public.month_closes where house_id = p_house and month_closes.month = month_of);
    select coalesce(-sum(amount_minor), 0)::integer into old_forfeit
    from public.ledger where assignment_id = a.id and kind = 'forfeit';
    credit_before := public.credited_to(a);
    if p_kind = 'result' then
      new_forfeit := case v_outcome
        when 'late' then coalesce((p_forfeits ->> 'late')::integer, 0)
        when 'missed' then coalesce((p_forfeits ->> 'missed')::integer, 0)
        else 0 end;
      credit_after := case when v_outcome = 'missed' then null else a.user_id end;
    elsif p_kind = 'skip' then
      new_forfeit := 0;
      credit_after := null;
    elsif p_kind = 'letoff' then
      new_forfeit := 0;
      credit_after := credit_before;
    else
      new_forfeit := 0;
      credit_after := a.user_id;
      reopened := reopened + 1;
      if a.due_at < now() then
        past_due := past_due + 1;
      end if;
    end if;
    if p_kind in ('person_week', 'week', 'redeal') and a.done_at is not null then
      people := public.reset_bump(people, coalesce(a.covered_by, a.user_id), 'ticks', 1);
    end if;
    -- Balances only move for weeks the deal has counted (any week before this one).
    if p_kind <> 'skip' and credit_before is distinct from credit_after then
      people := public.reset_bump(people, credit_before, 'points', -a.points);
      people := public.reset_bump(people, credit_after, 'points', a.points);
    elsif p_kind = 'skip' then
      people := public.reset_bump(people, credit_before, 'points', -a.points);
    end if;
    if old_forfeit <> new_forfeit then
      people := public.reset_bump(people, a.user_id, 'forfeit', old_forfeit - new_forfeit);
      correction := correction or closed;
    end if;
    told := told || a.user_id || a.covered_by;
  end loop;

  for a in select * from public.assignments where id = any (flag_ids) loop
    n_flags := n_flags + 1;
    if a.done_at is not null then
      people := public.reset_bump(people, coalesce(a.covered_by, a.user_id), 'ticks', 1);
    end if;
    people := public.reset_bump(people, public.credited_to(a), 'points', -a.points);
    sharers := public.flag_sharers(a.john_id);
    foreach s in array sharers loop
      people := public.reset_bump(people, s, 'points', round(a.points::numeric / greatest(cardinality(sharers), 1), 2));
    end loop;
    select coalesce(-sum(amount_minor), 0)::integer into old_forfeit
    from public.ledger where assignment_id = a.id and kind = 'forfeit';
    if old_forfeit <> 0 then
      people := public.reset_bump(people, a.user_id, 'forfeit', old_forfeit);
    end if;
    told := told || a.user_id || a.covered_by;
  end loop;

  if p_kind = 'skip' then
    -- What everyone owed for the week comes off too.
    declare
      sh record;
    begin
      for sh in select user_id, share from public.week_shares where week_id = w.id loop
        people := public.reset_bump(people, sh.user_id, 'points', sh.share);
        told := told || sh.user_id;
      end loop;
    end;
  end if;

  if p_kind = 'letoff' then
    -- The tally is the month's forfeits, per person.
    people := '{}'::jsonb;
    declare
      r record;
    begin
      for r in
        select user_id, -sum(amount_minor)::integer as amount from public.ledger
        where house_id = p_house and ledger.month = v_month and kind = 'forfeit' group by user_id
      loop
        people := public.reset_bump(people, r.user_id, 'forfeit', r.amount);
        told := told || r.user_id;
      end loop;
    end;
    correction := exists (select 1 from public.month_closes where house_id = p_house and month_closes.month = v_month);
  end if;

  select count(*) into n_disputes from public.disputes
  where resolution is null and (assignment_id = any (ids) or assignment_id = any (flag_ids));

  select coalesce(array_agg(distinct t), '{}') into told from unnest(told) t where t is not null and t <> p_actor;
  nothing := case p_kind
    when 'skip' then false
    when 'redeal' then false
    when 'letoff' then people = '{}'::jsonb
    else cardinality(ids) + cardinality(flag_ids) = 0 end;

  if not p_apply then
    return jsonb_build_object(
      'kind', p_kind,
      'week', case when w.id is null then null else jsonb_build_object(
        'id', w.id, 'starts_on', w.starts_on, 'starts_at', w.starts_at, 'ends_at', w.ends_at) end,
      'month', coalesce(v_month, w_month, to_char(target.due_at at time zone h.timezone, 'YYYY-MM')),
      'people', people,
      'told', to_jsonb(told),
      'reopened', reopened,
      'past_due', past_due,
      'flags', n_flags,
      'disputes', n_disputes,
      'correction', correction,
      'nothing', nothing
    );
  end if;

  if nothing then
    raise exception 'nothing_to_reset';
  end if;

  -- --- What undoing it needs: every row it changes, as it was.
  snapshot := jsonb_build_object(
    'assignments', coalesce((select jsonb_agg(to_jsonb(x)) from public.assignments x
                             where x.id = any (ids) or x.id = any (flag_ids)
                                or (p_kind = 'redeal' and x.week_id = w.id)), '[]'::jsonb),
    'ledger', coalesce((select jsonb_agg(to_jsonb(l)) from public.ledger l
                        where l.kind = 'forfeit' and (l.assignment_id = any (ids) or l.assignment_id = any (flag_ids)
                          or (p_kind = 'letoff' and l.house_id = p_house and l.month = v_month))), '[]'::jsonb),
    'disputes', coalesce((select jsonb_agg(to_jsonb(d)) from public.disputes d
                          where d.assignment_id = any (ids) or d.assignment_id = any (flag_ids)), '[]'::jsonb),
    'votes', coalesce((select jsonb_agg(to_jsonb(v)) from public.dispute_votes v join public.disputes d on d.id = v.dispute_id
                       where d.assignment_id = any (ids) or d.assignment_id = any (flag_ids)), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e)) from public.events e
                        where (e.assignment_id = any (ids) or e.assignment_id = any (flag_ids))
                          and e.kind in ('done', 'late', 'covered', 'missed', 'flagged', 'disputed', 'immunity_used')), '[]'::jsonb),
    'shares', case when w.id is null then '[]'::jsonb else coalesce(
      (select jsonb_agg(to_jsonb(ws)) from public.week_shares ws where ws.week_id = w.id), '[]'::jsonb) end,
    'on_call', case when p_kind = 'redeal' then coalesce(
      (select jsonb_agg(to_jsonb(oc)) from public.on_call oc where oc.week_id = w.id), '[]'::jsonb) else '[]'::jsonb end,
    'skipped_at', w.skipped_at
  );

  -- --- The change.
  if p_kind = 'result' then
    a := target;
    month_of := to_char(a.due_at at time zone h.timezone, 'YYYY-MM');
    closed := exists (select 1 from public.month_closes where house_id = p_house and month_closes.month = month_of);
    select coalesce(-sum(amount_minor), 0)::integer into old_forfeit
    from public.ledger where assignment_id = a.id and kind = 'forfeit';
    new_forfeit := case v_outcome
      when 'late' then coalesce((p_forfeits ->> 'late')::integer, 0)
      when 'missed' then coalesce((p_forfeits ->> 'missed')::integer, 0)
      else 0 end;
    if closed then
      added := added || public.add_correction(p_house, a.user_id, old_forfeit - new_forfeit, month_now, a.id);
    else
      delete from public.ledger where assignment_id = a.id and kind = 'forfeit';
      if new_forfeit > 0 then
        insert into public.ledger (house_id, user_id, kind, amount_minor, month, assignment_id)
        values (p_house, a.user_id, 'forfeit', -new_forfeit, month_of, a.id)
        returning id into lid;
        added := added || lid;
      end if;
    end if;
    update public.assignments
    set outcome = v_outcome,
        settled_at = coalesce(settled_at, now()),
        excused = v_outcome = 'excused',
        covered_by = null,
        done_at = case when v_outcome in ('done', 'late') then coalesce(done_at, least(now(), due_at)) end,
        changed_by = p_actor,
        changed_at = now()
    where id = a.id;
    delete from public.events where assignment_id = a.id and kind in ('missed', 'covered')
      and v_outcome <> 'missed';
  elsif p_kind in ('person_week', 'week', 'redeal') then
    for a in select * from public.assignments where id = any (ids) or id = any (flag_ids) loop
      month_of := to_char(a.due_at at time zone h.timezone, 'YYYY-MM');
      closed := exists (select 1 from public.month_closes where house_id = p_house and month_closes.month = month_of);
      select coalesce(-sum(amount_minor), 0)::integer into old_forfeit
      from public.ledger where assignment_id = a.id and kind = 'forfeit';
      if old_forfeit <> 0 and closed then
        added := added || public.add_correction(p_house, a.user_id, old_forfeit, month_now, a.id);
      else
        delete from public.ledger where assignment_id = a.id and kind = 'forfeit';
      end if;
    end loop;
    delete from public.disputes where assignment_id = any (ids) or assignment_id = any (flag_ids);
    delete from public.events
    where (assignment_id = any (ids)) and kind in ('done', 'late', 'covered', 'missed', 'immunity_used');
    -- A flag goes with its points (and, with it, its Wall post).
    for a in select * from public.assignments where id = any (flag_ids) loop
      sharers := public.flag_sharers(a.john_id);
      update public.week_shares
      set share = greatest(share - round(a.points::numeric / greatest(cardinality(sharers), 1), 2), 0)
      where week_id = a.week_id and user_id = any (sharers);
    end loop;
    delete from public.assignments where id = any (flag_ids);
    update public.assignments
    set done_at = null, photo_path = null, covered_by = null, outcome = null, settled_at = null,
        excused = false, changed_by = p_actor, changed_at = now()
    where id = any (ids);
  elsif p_kind = 'skip' then
    for a in select * from public.assignments where id = any (ids) loop
      month_of := to_char(a.due_at at time zone h.timezone, 'YYYY-MM');
      closed := exists (select 1 from public.month_closes where house_id = p_house and month_closes.month = month_of);
      select coalesce(-sum(amount_minor), 0)::integer into old_forfeit
      from public.ledger where assignment_id = a.id and kind = 'forfeit';
      if old_forfeit <> 0 and closed then
        added := added || public.add_correction(p_house, a.user_id, old_forfeit, month_now, a.id);
      else
        delete from public.ledger where assignment_id = a.id and kind = 'forfeit';
      end if;
    end loop;
    delete from public.disputes where assignment_id = any (ids) and resolution is null;
    -- Whatever wasn't done is let off; whatever was keeps its mark.
    update public.assignments
    set excused = true, outcome = 'excused', settled_at = now()
    where id = any (ids) and outcome is null and done_at is null;
    update public.assignments
    set outcome = case when done_at <= due_at then 'done' else 'late' end, settled_at = now()
    where id = any (ids) and outcome is null;
    update public.weeks set skipped_at = now(), skipped_by = p_actor where id = w.id;
  elsif p_kind = 'letoff' then
    if correction then
      declare
        r record;
      begin
        -- The month's forfeits, cap refunds and shares, each person's net, handed back.
        for r in
          select user_id, sum(amount_minor)::integer as net from public.ledger
          where house_id = p_house and ledger.month = v_month and kind in ('forfeit', 'cap_refund', 'share')
          group by user_id having sum(amount_minor) <> 0
        loop
          insert into public.ledger (house_id, user_id, kind, amount_minor, month)
          values (p_house, r.user_id, 'correction', -r.net, month_now)
          returning id into lid;
          added := added || lid;
        end loop;
      end;
    else
      delete from public.ledger where house_id = p_house and ledger.month = v_month and kind = 'forfeit';
    end if;
    insert into public.month_let_offs (house_id, month, let_off_by) values (p_house, v_month, p_actor);
  end if;

  perform public.recount_streaks(p_house);

  insert into public.events (house_id, kind, user_id, assignment_id, data)
  values (p_house, 'reset', p_actor, case when p_kind = 'result' then target.id end,
          jsonb_build_object('what', p_kind, 'name', v_name, 'subject', v_subject, 'outcome', v_outcome,
                             'starts_on', w.starts_on, 'month', v_month))
  returning id into event;

  insert into public.house_actions (house_id, actor, subject, kind, assignment_id, ref, data)
  values (p_house, p_actor, v_subject, 'reset', case when p_kind = 'result' then target.id end, w.id,
          jsonb_build_object('what', p_kind, 'name', v_name, 'outcome', v_outcome, 'starts_on', w.starts_on,
                             'month', coalesce(v_month, w_month), 'week_month', w_month, 'event', event,
                             'added', to_jsonb(added), 'told', to_jsonb(told), 'snapshot', snapshot))
  returning id into action;

  return jsonb_build_object('action', action, 'told', to_jsonb(told));
end;
$$;

-- --- Undoing a reset ---------------------------------------------------------------------

-- An admin, until the month it touched (and the month its corrections went
-- in) is shared out, while nobody has ticked or flagged anything it
-- touched since.
create function public.reset_reach(x public.house_actions)
returns text
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  ids uuid[];
  h public.houses;
begin
  if not public.is_admin(x.house_id) then
    return null;
  end if;
  select * into h from public.houses where id = x.house_id;
  if exists (
    select 1 from public.month_closes c
    where c.house_id = x.house_id
      and c.month in (x.data ->> 'month', x.data ->> 'week_month', to_char(x.created_at at time zone h.timezone, 'YYYY-MM'))
  ) and x.data ->> 'what' <> 'letoff' then
    return null;
  end if;
  if x.data ->> 'what' = 'letoff' and exists (
    select 1 from public.month_closes c
    where c.house_id = x.house_id and c.month = to_char(x.created_at at time zone h.timezone, 'YYYY-MM')
  ) then
    return null;
  end if;
  select coalesce(array_agg((s ->> 'id')::uuid), '{}') into ids
  from jsonb_array_elements(x.data -> 'snapshot' -> 'assignments') s;
  if exists (
    select 1 from public.assignments a
    where (a.id = any (ids) or (x.data ->> 'what' in ('week', 'redeal') and a.week_id = x.ref))
      and (a.done_at > x.created_at or a.flagged_at > x.created_at)
  ) then
    return null;
  end if;
  return 'admin';
end;
$$;

-- Put back every row a reset changed, as it was.
create function public.undo_reset(x public.house_actions)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  snap jsonb := x.data -> 'snapshot';
  ids uuid[];
begin
  select coalesce(array_agg((s ->> 'id')::uuid), '{}') into ids from jsonb_array_elements(snap -> 'assignments') s;

  if x.data ->> 'what' = 'redeal' then
    -- The new deal goes; the old one comes back below.
    delete from public.assignments where week_id = x.ref and not (id = any (ids));
    delete from public.on_call where week_id = x.ref;
    insert into public.on_call select * from jsonb_populate_recordset(null::public.on_call, snap -> 'on_call');
  end if;

  -- Money: whatever the reset (or the clock, since) charged on these Johns,
  -- and its corrections, go; the forfeits it took away come back.
  delete from public.ledger where kind = 'forfeit' and assignment_id = any (ids);
  delete from public.ledger where id in (select (jsonb_array_elements_text(x.data -> 'added'))::bigint);
  if x.data ->> 'what' = 'letoff' then
    delete from public.ledger where house_id = x.house_id and month = x.data ->> 'month' and kind = 'forfeit';
    delete from public.month_let_offs where house_id = x.house_id and month = x.data ->> 'month';
  end if;

  update public.assignments t
  set user_id = r.user_id, done_at = r.done_at, photo_path = r.photo_path, covered_by = r.covered_by,
      outcome = r.outcome, settled_at = r.settled_at, excused = r.excused, due_at = r.due_at,
      changed_by = r.changed_by, changed_at = r.changed_at
  from jsonb_populate_recordset(null::public.assignments, snap -> 'assignments') r
  where t.id = r.id;
  insert into public.assignments
  select r.* from jsonb_populate_recordset(null::public.assignments, snap -> 'assignments') r
  where not exists (select 1 from public.assignments t where t.id = r.id);

  insert into public.ledger overriding system value
  select r.* from jsonb_populate_recordset(null::public.ledger, snap -> 'ledger') r
  where not exists (select 1 from public.ledger l where l.id = r.id);

  insert into public.disputes
  select r.* from jsonb_populate_recordset(null::public.disputes, snap -> 'disputes') r
  where not exists (select 1 from public.disputes d where d.id = r.id);
  insert into public.dispute_votes
  select r.* from jsonb_populate_recordset(null::public.dispute_votes, snap -> 'votes') r
  on conflict do nothing;
  insert into public.events
  select r.* from jsonb_populate_recordset(null::public.events, snap -> 'events') r
  where not exists (select 1 from public.events e where e.id = r.id);

  if x.ref is not null and x.data ->> 'what' <> 'result' then
    delete from public.week_shares where week_id = x.ref;
    insert into public.week_shares select * from jsonb_populate_recordset(null::public.week_shares, snap -> 'shares');
    update public.weeks set skipped_at = (snap ->> 'skipped_at')::timestamptz,
      skipped_by = case when snap ->> 'skipped_at' is null then null else skipped_by end
    where id = x.ref;
  end if;

  delete from public.events where id = (x.data ->> 'event')::uuid;
  perform public.recount_streaks(x.house_id);
end;
$$;

-- --- undo_reach and undo_action, as 20261101090000 has them, with resets -------------------

create or replace function public.undo_reach(x public.house_actions)
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
  if x.kind = 'reset' then
    return public.reset_reach(x);
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

  -- An admin taking back someone else's move says so on the Wall, to them.
  if x.actor is not null and x.actor <> me then
    insert into public.events (house_id, kind, user_id, assignment_id, data)
    values (x.house_id, 'undone', x.actor,
            case when x.kind = 'flag' then null else x.assignment_id end,
            jsonb_build_object('by', me, 'what', x.kind, 'name', x.data ->> 'name', 'action', x.id));
  end if;
end;
$$;

revoke execute on function public.undo_reach(public.house_actions), public.undo_action(uuid)
from public, anon, authenticated;
grant execute on function public.undo_action(uuid) to authenticated;
grant execute on function public.undo_reach(public.house_actions), public.undo_action(uuid) to service_role;

-- History, as 20261101090000 has it, without what undoing a reset needs (its
-- rows as they were): History shows the words, undo_action reads the rest.
create or replace function public.house_history(p_house uuid, p_before timestamptz default null, p_limit integer default 60)
returns table (
  id uuid, kind text, actor uuid, subject uuid, assignment_id uuid, ref uuid, data jsonb,
  created_at timestamptz, undone_at timestamptz, undone_by uuid, reach text
)
language sql
stable
security definer set search_path = ''
as $$
  select x.id, x.kind, x.actor, x.subject, x.assignment_id, x.ref, x.data - 'snapshot', x.created_at, x.undone_at, x.undone_by,
         public.undo_reach(x)
  from public.house_actions x
  where x.house_id = p_house and public.is_member(p_house)
    and (p_before is null or x.created_at < p_before)
  order by x.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;

revoke execute on function public.house_history(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.house_history(uuid, timestamptz, integer) to authenticated, service_role;

-- --- Handing over --------------------------------------------------------------------------

-- The only admin leaves by making someone else admin first, in one step.
create function public.hand_over(p_house uuid, p_to uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
begin
  if not public.is_admin(p_house) then
    raise exception 'admins_only' using errcode = '42501';
  end if;
  if p_to = me or not exists (select 1 from public.members where house_id = p_house and user_id = p_to) then
    raise exception 'not_in_house' using errcode = '22023';
  end if;
  perform public.set_member_role(p_house, p_to, 'admin');
  perform public.remove_member(p_house, me);
end;
$$;

revoke execute on function
  public.recount_streaks(uuid), public.reset_bump(jsonb, uuid, text, numeric),
  public.credited_to(public.assignments), public.flag_sharers(uuid),
  public.add_correction(uuid, uuid, integer, text, uuid),
  public.admin_reset(uuid, uuid, text, jsonb, jsonb, boolean),
  public.reset_reach(public.house_actions), public.undo_reset(public.house_actions),
  public.hand_over(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.hand_over(uuid, uuid) to authenticated;
grant execute on function
  public.recount_streaks(uuid), public.reset_bump(jsonb, uuid, text, numeric),
  public.credited_to(public.assignments), public.flag_sharers(uuid),
  public.add_correction(uuid, uuid, integer, text, uuid),
  public.admin_reset(uuid, uuid, text, jsonb, jsonb, boolean),
  public.reset_reach(public.house_actions), public.undo_reset(public.house_actions),
  public.hand_over(uuid, uuid)
to service_role;
