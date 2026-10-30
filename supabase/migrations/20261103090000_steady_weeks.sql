-- Steady weeks: the deal with a points budget, in Smart or Classic, with
-- preferences, Keep its day, Plan it and asking to swap a John you'd rather
-- not (docs/specs/steady-weeks.md).
--
-- The rules are @app/core steady.ts; the engine (apps/api lib/engine/tick.ts)
-- deals with them each Monday and keeps what next week's deal needs on the
-- week it dealt: Classic's orders of turns, which Johns are waiting, and the
-- next two weeks as it would hand them out.
--
-- After 20261102090000_shared_jonz: deal_week gains one defaulted argument,
-- so it is dropped and made again with its grants.

-- --- House rules ---------------------------------------------------------------------

-- How the deal chooses: Smart (suggested) weighs balances, who did what last
-- time and everyone's preferences; Classic takes turns in a fixed order.
alter table public.houses add column deal_mode text not null default 'smart'
  check (deal_mode in ('smart', 'classic'));
-- Points a week each: Light 2, Usual 4, Busy 6, or 0 for no limit. Houses
-- that already exist keep the deal they had (no limit) until an admin picks;
-- a new house starts on Usual.
alter table public.houses add column deal_budget smallint not null default 0
  check (deal_budget in (0, 2, 4, 6));
alter table public.houses alter column deal_budget set default 4;

grant update (deal_mode, deal_budget) on public.houses to authenticated;

-- --- Keep its day --------------------------------------------------------------------

-- A John that keeps its day (bins night) is always dealt, always on its own
-- day, whatever the budget. An on-call John has no day to keep.
alter table public.johns add column keep_day boolean not null default false;
alter table public.johns add constraint johns_keep_day_on_call check (kind = 'day' or not keep_day);

grant insert (keep_day), update (keep_day) on public.johns to authenticated;

-- --- Preferences ---------------------------------------------------------------------

-- Each person's, kept on their membership: the days that suit them (ISO
-- weekdays, none is any day), their best time of day for Plan it, and the
-- Johns they'd rather do (1) or rather not (-1), by John id. Housemates can
-- read them (the swap suggestion needs to); only save_prefs writes them.
alter table public.members add column suits_days smallint[] not null default '{}'
  check (suits_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]);
alter table public.members add column best_time text
  check (best_time in ('morning', 'afternoon', 'evening'));
alter table public.members add column rather jsonb not null default '{}'::jsonb
  check (jsonb_typeof(rather) = 'object');

create or replace function public.save_prefs(
  p_house uuid,
  p_days smallint[],
  p_best_time text,
  p_rather jsonb
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  kept jsonb;
begin
  if not public.is_member(p_house) then
    raise exception 'not_in_house' using errcode = '42501';
  end if;
  if p_best_time is not null and p_best_time not in ('morning', 'afternoon', 'evening') then
    raise exception 'bad_prefs';
  end if;
  if p_days is not null and not (p_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]) then
    raise exception 'bad_prefs';
  end if;
  if p_rather is not null and jsonb_typeof(p_rather) <> 'object' then
    raise exception 'bad_prefs';
  end if;
  -- Only this house's Johns, and only rather do (1) or rather not (-1).
  select coalesce(jsonb_object_agg(r.key, (r.value #>> '{}')::smallint), '{}'::jsonb) into kept
  from jsonb_each(coalesce(p_rather, '{}'::jsonb)) r
  join public.johns j on j.id::text = r.key and j.house_id = p_house and j.archived_at is null
  where r.value #>> '{}' in ('1', '-1');

  update public.members
  set suits_days = (select coalesce(array_agg(distinct d order by d), '{}') from unnest(coalesce(p_days, '{}')) d),
      best_time = p_best_time,
      rather = kept
  where house_id = p_house and user_id = me;
end;
$$;

-- --- Plan it -------------------------------------------------------------------------

-- When the holder means to do it. The reminder comes then, instead of the
-- usual "due tomorrow" and "due soon" (assignments.reminded = 3 once it has
-- been sent); it moves nothing else, so the John is still due when it's due.
alter table public.assignments add column planned_at timestamptz;

-- A John that changes hands (a swap, a hand-over) leaves its old holder's plan behind.
create or replace function public.clear_plan_on_new_holder()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    new.planned_at := null;
  end if;
  return new;
end;
$$;

create trigger assignments_clear_plan
  before update of user_id on public.assignments
  for each row execute function public.clear_plan_on_new_holder();

-- Plan your own open John for a time from now until its week ends, or clear
-- the plan with null.
create or replace function public.plan_john(p_assignment uuid, p_at timestamptz)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  a public.assignments;
  ends timestamptz;
begin
  select * into a from public.assignments where id = p_assignment for update;
  if a.id is null or not public.is_member(a.house_id) then
    raise exception 'not_found';
  end if;
  if a.user_id <> me then
    raise exception 'not_your_john' using errcode = '42501';
  end if;
  if a.outcome is not null or a.done_at is not null or a.absent_at is not null then
    raise exception 'already_settled';
  end if;
  select w.ends_at into ends from public.weeks w where w.id = a.week_id;
  if p_at is not null and (p_at < now() - interval '5 minutes' or p_at > ends) then
    raise exception 'plan_time';
  end if;
  -- A new plan gets its own reminder.
  update public.assignments
  set planned_at = p_at, reminded = case when reminded = 3 then 0 else reminded end
  where id = p_assignment;
end;
$$;

-- --- What next week's deal needs -----------------------------------------------------

-- Kept by deal_week on the week it dealt: Classic's orders of turns after the
-- deal (John id to user ids, null in Smart), the Johns it left waiting (John
-- id to how many weeks they'll have waited by the next deal), and the next
-- two weeks as the deal would hand them out (Week's whose turn next: a list
-- of {startsOn, johns: John id to user ids}). Housemates read them with the
-- week, as they already can.
alter table public.weeks add column turns jsonb;
alter table public.weeks add column waiting jsonb not null default '{}'::jsonb
  check (jsonb_typeof(waiting) = 'object');
alter table public.weeks add column ahead jsonb not null default '[]'::jsonb
  check (jsonb_typeof(ahead) = 'array');

drop function public.deal_week(uuid, date, timestamptz, timestamptz, jsonb, jsonb, boolean, jsonb);

create function public.deal_week(
  p_house uuid,
  p_starts_on date,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_assignments jsonb,
  p_shares jsonb,
  p_replace boolean default false,
  p_on_call jsonb default '[]'::jsonb,
  p_state jsonb default null
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

  update public.weeks
  set turns = case when jsonb_typeof(p_state -> 'turns') = 'object' then p_state -> 'turns' end,
      waiting = case when jsonb_typeof(p_state -> 'waiting') = 'object' then p_state -> 'waiting' else '{}'::jsonb end,
      ahead = case when jsonb_typeof(p_state -> 'ahead') = 'array' then p_state -> 'ahead' else '[]'::jsonb end
  where id = week;

  update public.houses set first_dealt_at = coalesce(first_dealt_at, now()) where id = p_house;
  insert into public.events (house_id, kind, data)
  values (p_house, 'week_dealt', jsonb_build_object(
    'starts_on', p_starts_on,
    'count', jsonb_array_length(p_assignments) + jsonb_array_length(p_on_call)
  ));
  return week;
end;
$$;

-- --- Asking to swap a John you'd rather not --------------------------------------------

-- An ask to swap one of your Johns for a housemate's, when they'd rather do
-- yours. They answer in Jonz by the end of the day in the house's zone; until
-- then, and after a no, it stays yours. No swap token: it's theirs to agree
-- to. Only the two of them see it, and only these two functions write it.
create table public.swap_offers (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  -- The asker's John, and the one of theirs it would swap for.
  mine uuid not null references public.assignments (id) on delete cascade,
  theirs uuid not null references public.assignments (id) on delete cascade,
  asked_by uuid not null references public.profiles (id) on delete cascade,
  asked_to uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  answer text check (answer in ('accepted', 'declined')),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  check ((answer is null) = (answered_at is null))
);

-- One open ask a John.
create unique index swap_offers_one_open on public.swap_offers (mine) where answer is null;
create index swap_offers_house on public.swap_offers (house_id, created_at desc);

alter table public.swap_offers enable row level security;
create policy "the two of them see an ask" on public.swap_offers
  for select to authenticated using ((select auth.uid()) in (asked_by, asked_to));

revoke all on public.swap_offers from anon, authenticated;
grant select on public.swap_offers to authenticated;
grant select, insert, update, delete on public.swap_offers to service_role;

-- Ask: your open John for theirs, this week, when they'd rather do yours.
create or replace function public.offer_swap(p_mine uuid, p_theirs uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  given public.assignments := public.my_open_assignment(p_mine);
  taken public.assignments;
  zone text;
  offer uuid;
begin
  select * into taken from public.assignments where id = p_theirs;
  if taken.id is null or taken.house_id <> given.house_id or taken.week_id <> given.week_id
     or taken.user_id = given.user_id
     or given.done_at is not null or given.flagged_at is not null or given.job_id is not null
     or taken.done_at is not null or taken.outcome is not null or taken.absent_at is not null
     or taken.flagged_at is not null or taken.job_id is not null then
    raise exception 'not_swappable';
  end if;
  if not exists (
    select 1 from public.members m
    where m.house_id = given.house_id and m.user_id = taken.user_id and m.rather -> (given.john_id::text) = '1'::jsonb
  ) then
    raise exception 'not_swappable';
  end if;
  -- An ask that ran out unanswered is let go, so the John can be asked about again.
  delete from public.swap_offers where swap_offers.mine = p_mine and answer is null and expires_at <= now();
  select h.timezone into zone from public.houses h where h.id = given.house_id;
  insert into public.swap_offers (house_id, mine, theirs, asked_by, asked_to, expires_at)
  values (given.house_id, given.id, taken.id, given.user_id, taken.user_id,
          (date_trunc('day', now() at time zone zone) + interval '1 day') at time zone zone)
  on conflict (mine) where answer is null do nothing
  returning id into offer;
  if offer is null then
    raise exception 'already_asked';
  end if;
  return offer;
end;
$$;

-- Answer an ask made to you. Yes swaps the two Johns, if both are still
-- open with the same two people; no leaves them be.
create or replace function public.answer_swap(p_offer uuid, p_accept boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  o public.swap_offers;
  given public.assignments;
  taken public.assignments;
begin
  select * into o from public.swap_offers where id = p_offer for update;
  if o.id is null or o.asked_to <> me then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if o.answer is not null or o.expires_at <= now() then
    raise exception 'swap_gone';
  end if;
  if not coalesce(p_accept, false) then
    update public.swap_offers set answer = 'declined', answered_at = now() where id = o.id;
    return;
  end if;
  select * into given from public.assignments where id = o.mine for update;
  select * into taken from public.assignments where id = o.theirs for update;
  if given.id is null or taken.id is null or given.user_id <> o.asked_by or taken.user_id <> o.asked_to
     or given.done_at is not null or given.outcome is not null or given.absent_at is not null
     or taken.done_at is not null or taken.outcome is not null or taken.absent_at is not null then
    raise exception 'not_swappable';
  end if;
  update public.assignments set user_id = o.asked_to, reminded = 0 where id = given.id;
  update public.assignments set user_id = o.asked_by, reminded = 0 where id = taken.id;
  update public.swap_offers set answer = 'accepted', answered_at = now() where id = o.id;
  insert into public.events (house_id, kind, user_id, assignment_id, data)
  values (o.house_id, 'swap_used', o.asked_by, taken.id,
          jsonb_build_object('gave', given.name, 'took', taken.name, 'with', o.asked_to, 'asked', true));
end;
$$;

-- --- Grants --------------------------------------------------------------------------

revoke execute on function
  public.save_prefs(uuid, smallint[], text, jsonb), public.plan_john(uuid, timestamptz),
  public.offer_swap(uuid, uuid), public.answer_swap(uuid, boolean),
  public.clear_plan_on_new_holder(),
  public.deal_week(uuid, date, timestamptz, timestamptz, jsonb, jsonb, boolean, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function
  public.save_prefs(uuid, smallint[], text, jsonb), public.plan_john(uuid, timestamptz),
  public.offer_swap(uuid, uuid), public.answer_swap(uuid, boolean)
to authenticated, service_role;
grant execute on function
  public.deal_week(uuid, date, timestamptz, timestamptz, jsonb, jsonb, boolean, jsonb, jsonb)
to service_role;
