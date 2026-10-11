-- ---------------------------------------------------------------------------
-- Johns: the house, its Johns, the weekly deal, the Stake and the Wall.
--
-- The access model, stated once:
--
--   * Housemates READ their own house through RLS (every table keys on
--     public.is_member).
--   * Housemates WRITE through named SECURITY DEFINER functions only, each of
--     which checks who is calling and what state the row is in. The tables
--     themselves grant `authenticated` nothing but SELECT, plus a few column
--     grants where a plain update is the honest shape (house settings, the
--     John list, your own name, reactions, push subscriptions).
--   * The clock's work (handing out the week, settling outcomes, closing
--     weeks and months) is decided in TypeScript (lib/engine) and applied by
--     service-role-only functions that are idempotent and atomic, so two
--     ticks racing each other can never double a forfeit or a token.
--
-- Errors: 42501 for "not yours to do", P0001 with a short code in the
-- message for a rule ("week_closed", "already_in_house").
-- ---------------------------------------------------------------------------

-- --- Profiles ---------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Google hands over `full_name`/`name`; the test suites set `display_name`.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Housemate'
    ), 60),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- Houses -----------------------------------------------------------------

-- Eight characters from an alphabet with no look-alikes (no 0/O, 1/I/L).
-- The code is the whole of what it takes to ask to join, so it comes from
-- the CSPRNG rather than random().
create function public.new_join_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  code text := '';
begin
  for i in 0..7 loop
    code := code || substr(alphabet, 1 + (get_byte(bytes, i) % length(alphabet)), 1);
  end loop;
  return code;
end;
$$;

create table public.houses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  join_code text not null unique default public.new_join_code(),
  timezone text not null default 'Europe/London',
  currency text not null default 'GBP' check (currency in ('GBP', 'CAD', 'USD', 'EUR')),
  week_starts smallint not null default 1 check (week_starts between 1 and 7),
  stake_minor integer not null default 2000 check (stake_minor between 0 and 100000),
  late_forfeit_minor integer not null default 100 check (late_forfeit_minor between 0 and 100000),
  missed_forfeit_minor integer not null default 300 check (missed_forfeit_minor between 0 and 100000),
  dispute_hours smallint not null default 24 check (dispute_hours between 0 and 72),
  -- Null until an admin hands out the first week. Nothing is dealt before
  -- then, so a house can add its Johns and its people first.
  first_dealt_at timestamptz,
  -- When the engine last caught this house up (lib/engine/tick.ts).
  ticked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- A CHECK cannot look a zone up, so a trigger does.
create function public.validate_house()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'unknown_timezone' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger validate_house
  before insert or update of timezone on public.houses
  for each row execute function public.validate_house();

-- --- Members ----------------------------------------------------------------

create table public.members (
  house_id uuid not null references public.houses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  -- Perks (lib/streak.ts). Caps mirror IMMUNITY_CAP and SWAP_CAP.
  streak smallint not null default 0 check (streak >= 0),
  immunity_tokens smallint not null default 0 check (immunity_tokens between 0 and 2),
  swap_tokens smallint not null default 0 check (swap_tokens between 0 and 1),
  primary key (house_id, user_id)
);

-- One house per person for now ("Belong to more than one house" is on the
-- later list). Dropping this index is all that feature needs from the schema.
create unique index members_one_house on public.members (user_id);

create function public.is_member(h uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.house_id = h and m.user_id = (select auth.uid())
  );
$$;

create function public.is_admin(h uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.house_id = h and m.user_id = (select auth.uid()) and m.role = 'admin'
  );
$$;

create function public.shares_house(other uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.members mine
    join public.members theirs on theirs.house_id = mine.house_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  );
$$;

-- --- Johns (the house's list) -------------------------------------------------

create table public.johns (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  category text not null default 'other'
    check (category in ('kitchen', 'bathroom', 'bins', 'floors', 'errands', 'other')),
  points smallint not null default 2 check (points between 1 and 10),
  every_weeks smallint not null default 1 check (every_weeks between 1 and 4),
  -- lib/week.ts weekIndex of the first week it is due; with every_weeks it
  -- decides which weeks a fortnightly John lands in.
  anchor_week integer not null,
  due_dow smallint not null default 7 check (due_dow between 1 and 7),
  due_time time not null default '21:00',
  needs_photo boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index johns_house on public.johns (house_id) where archived_at is null;

-- --- Weeks and assignments ---------------------------------------------------

create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  starts_on date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (house_id, starts_on)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks (id) on delete cascade,
  house_id uuid not null references public.houses (id) on delete cascade,
  john_id uuid references public.johns (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Snapshot of the John as it was dealt: editing the list later never
  -- rewrites a week that already happened.
  name text not null,
  category text not null,
  points smallint not null check (points between 1 and 10),
  needs_photo boolean not null default false,
  due_at timestamptz not null,
  done_at timestamptz,
  photo_path text,
  excused boolean not null default false,
  outcome text check (outcome in ('done', 'late', 'missed', 'excused')),
  settled_at timestamptz,
  -- Push reminders sent: 0 none, 1 the day before, 2 a few hours before.
  reminded smallint not null default 0,
  created_at timestamptz not null default now(),
  check ((outcome is null) = (settled_at is null))
);

create index assignments_week on public.assignments (week_id);
create index assignments_house_open on public.assignments (house_id) where outcome is null;
create index assignments_user on public.assignments (user_id);
create index assignments_john on public.assignments (john_id, due_at desc);

-- --- Disputes ------------------------------------------------------------------

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  house_id uuid not null references public.houses (id) on delete cascade,
  raised_by uuid references public.profiles (id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 1 and 280),
  -- The tick being disputed. One dispute per tick: a re-done John is a new tick.
  tick_at timestamptz not null,
  closes_at timestamptz not null,
  resolution text check (resolution in ('upheld', 'rejected')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (assignment_id, tick_at),
  check ((resolution is null) = (resolved_at is null))
);

create unique index disputes_one_open on public.disputes (assignment_id) where resolution is null;

create table public.dispute_votes (
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  uphold boolean not null,
  created_at timestamptz not null default now(),
  primary key (dispute_id, user_id)
);

-- --- The Stake's ledger (lib/stake.ts) ----------------------------------------

create table public.ledger (
  id bigint generated always as identity primary key,
  house_id uuid not null references public.houses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('forfeit', 'cap_refund', 'share', 'payment')),
  -- From this person's side: negative owes, positive is owed.
  amount_minor integer not null check (amount_minor <> 0),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  assignment_id uuid references public.assignments (id) on delete set null,
  counterparty uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index ledger_house on public.ledger (house_id, month);
create unique index ledger_one_forfeit on public.ledger (assignment_id) where kind = 'forfeit';
create unique index ledger_one_close on public.ledger (house_id, month, user_id, kind)
  where kind in ('cap_refund', 'share');

create table public.month_closes (
  house_id uuid not null references public.houses (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  closed_at timestamptz not null default now(),
  primary key (house_id, month)
);

-- --- The Wall ------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  kind text not null check (kind in (
    'joined', 'done', 'late', 'missed', 'disputed', 'upheld', 'rejected',
    'immunity_earned', 'immunity_used', 'swap_earned', 'swap_used',
    'week_dealt', 'month_closed', 'paid'
  )),
  user_id uuid references public.profiles (id) on delete set null,
  assignment_id uuid references public.assignments (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_house on public.events (house_id, created_at desc);

create table public.reactions (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('nice', 'fire', 'sparkle', 'eyes')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id, kind)
);

-- --- Push ------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.houses enable row level security;
alter table public.members enable row level security;
alter table public.johns enable row level security;
alter table public.weeks enable row level security;
alter table public.assignments enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_votes enable row level security;
alter table public.ledger enable row level security;
alter table public.month_closes enable row level security;
alter table public.events enable row level security;
alter table public.reactions enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "see yourself and housemates" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_house(id));
create policy "rename yourself" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "members see the house" on public.houses
  for select to authenticated using (public.is_member(id));
create policy "admins change the house" on public.houses
  for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));

create policy "members see each other" on public.members
  for select to authenticated using (public.is_member(house_id));

create policy "members see the list" on public.johns
  for select to authenticated using (public.is_member(house_id));
create policy "admins add Johns" on public.johns
  for insert to authenticated with check (public.is_admin(house_id));
create policy "admins edit Johns" on public.johns
  for update to authenticated
  using (public.is_admin(house_id)) with check (public.is_admin(house_id));

create policy "members see weeks" on public.weeks
  for select to authenticated using (public.is_member(house_id));
create policy "members see assignments" on public.assignments
  for select to authenticated using (public.is_member(house_id));
create policy "members see disputes" on public.disputes
  for select to authenticated using (public.is_member(house_id));
create policy "members see votes" on public.dispute_votes
  for select to authenticated
  using (exists (
    select 1 from public.disputes d
    where d.id = dispute_id and public.is_member(d.house_id)
  ));
create policy "members see the ledger" on public.ledger
  for select to authenticated using (public.is_member(house_id));
create policy "members see month closes" on public.month_closes
  for select to authenticated using (public.is_member(house_id));
create policy "members see the wall" on public.events
  for select to authenticated using (public.is_member(house_id));

create policy "members see reactions" on public.reactions
  for select to authenticated
  using (exists (
    select 1 from public.events e where e.id = event_id and public.is_member(e.house_id)
  ));
create policy "react as yourself" on public.reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and public.is_member(e.house_id))
  );
create policy "take back your reaction" on public.reactions
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "your own devices" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "add your device" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "remove your device" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Housemates' writes
-- ---------------------------------------------------------------------------

create function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sign_in_required' using errcode = '42501';
  end if;
  return me;
end;
$$;

-- Set up a house and seat its creator as admin.
create function public.create_house(
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
  return house;
end;
$$;

-- What a join link shows before you accept: the name and how many live there.
-- Signed-in only, so a link that leaks shows a crawler nothing.
create function public.house_by_code(p_code text)
returns table (id uuid, name text, members bigint)
language sql
stable
security definer set search_path = ''
as $$
  select h.id, h.name, (select count(*) from public.members m where m.house_id = h.id)
  from public.houses h
  where h.join_code = upper(btrim(p_code)) and auth.uid() is not null;
$$;

create function public.join_house(p_code text)
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
  if exists (select 1 from public.members where house_id = house and user_id = me) then
    return house;
  end if;
  if exists (select 1 from public.members where user_id = me) then
    raise exception 'already_in_house';
  end if;
  insert into public.members (house_id, user_id) values (house, me);
  insert into public.events (house_id, kind, user_id) values (house, 'joined', me);
  return house;
end;
$$;

-- Admins promote and demote. A house always keeps at least one admin.
create function public.set_member_role(p_house uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.require_user();
  if not public.is_admin(p_house) then
    raise exception 'admins_only' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'unknown_role' using errcode = '22023';
  end if;
  if p_role = 'member' and not exists (
    select 1 from public.members
    where house_id = p_house and role = 'admin' and user_id <> p_user
  ) then
    raise exception 'last_admin';
  end if;
  update public.members set role = p_role where house_id = p_house and user_id = p_user;
end;
$$;

-- Leave, or (as an admin) ask someone to. Their history stays with the house.
create function public.remove_member(p_house uuid, p_user uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
begin
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
  delete from public.members where house_id = p_house and user_id = p_user;
end;
$$;

-- An assignment the caller holds, locked for the rest of the transaction.
create function public.my_open_assignment(p_assignment uuid)
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
  if now() >= ends then
    raise exception 'week_closed';
  end if;
  return a;
end;
$$;

create function public.mark_done(p_assignment uuid, p_photo_path text default null)
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

-- Take a tick back while it is still being checked and nobody disputes it.
create function public.undo_done(p_assignment uuid)
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
  if exists (select 1 from public.disputes where assignment_id = a.id and resolution is null) then
    raise exception 'under_dispute';
  end if;
  update public.assignments set done_at = null, photo_path = null where id = a.id;
  delete from public.events
  where assignment_id = a.id and kind in ('done', 'late') and created_at >= a.done_at;
end;
$$;

create function public.raise_dispute(p_assignment uuid, p_reason text)
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
  if a.user_id = me then
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
          jsonb_build_object('name', a.name, 'against', a.user_id, 'reason', btrim(p_reason)));
  return dispute;
exception
  when unique_violation then
    raise exception 'already_disputed';
end;
$$;

-- Anyone but the person whose tick it is may vote, once, until it closes.
-- Deciding the result is the engine's (lib/dispute.ts), so the rule for a
-- majority lives in one place.
create function public.cast_vote(p_dispute uuid, p_uphold boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  d public.disputes;
  assignee uuid;
begin
  select * into d from public.disputes where id = p_dispute;
  if d.id is null or not public.is_member(d.house_id) then
    raise exception 'not_in_house' using errcode = '42501';
  end if;
  select user_id into assignee from public.assignments where id = d.assignment_id;
  if assignee = me then
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

-- Spend an immunity token: the John is excused, with no forfeit and no points.
create function public.use_immunity(p_assignment uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  a public.assignments := public.my_open_assignment(p_assignment);
begin
  if a.done_at is not null then
    raise exception 'already_done';
  end if;
  update public.members set immunity_tokens = immunity_tokens - 1
  where house_id = a.house_id and user_id = a.user_id and immunity_tokens > 0;
  if not found then
    raise exception 'no_immunity';
  end if;
  update public.assignments
  set excused = true, outcome = 'excused', settled_at = now()
  where id = a.id;
  insert into public.events (house_id, kind, user_id, assignment_id, data)
  values (a.house_id, 'immunity_used', a.user_id, a.id, jsonb_build_object('name', a.name));
end;
$$;

-- Spend a swap token: trade one of your open Johns for a housemate's open
-- John in the same week. The perk for topping the table.
create function public.use_swap(p_mine uuid, p_theirs uuid)
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
  if mine.done_at is not null or theirs.done_at is not null or theirs.outcome is not null then
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

-- The payee confirms money arrived. Only someone owed can say they were
-- paid, and never more than either side's balance.
create function public.confirm_payment(p_house uuid, p_from uuid, p_amount integer)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  h public.houses;
  mine bigint;
  theirs bigint;
  month text;
begin
  if not public.is_member(p_house) then
    raise exception 'not_in_house' using errcode = '42501';
  end if;
  if p_from = me or p_amount <= 0
     or not exists (select 1 from public.members where house_id = p_house and user_id = p_from) then
    raise exception 'bad_payment' using errcode = '22023';
  end if;
  -- One payment at a time per house, so two confirmations cannot both fit
  -- under the same balance.
  perform pg_advisory_xact_lock(hashtextextended('johns.payment:' || p_house::text, 0));
  select coalesce(sum(amount_minor), 0) into mine from public.ledger where house_id = p_house and user_id = me;
  select coalesce(sum(amount_minor), 0) into theirs from public.ledger where house_id = p_house and user_id = p_from;
  if p_amount > mine or p_amount > -theirs then
    raise exception 'more_than_owed';
  end if;
  select * into h from public.houses where id = p_house;
  month := to_char(now() at time zone h.timezone, 'YYYY-MM');
  insert into public.ledger (house_id, user_id, kind, amount_minor, month, counterparty)
  values (p_house, p_from, 'payment', p_amount, month, me),
         (p_house, me, 'payment', -p_amount, month, p_from);
  insert into public.events (house_id, kind, user_id, data)
  values (p_house, 'paid', p_from, jsonb_build_object('to', me, 'amount', p_amount));
end;
$$;

-- ---------------------------------------------------------------------------
-- The engine's writes (service role only). TypeScript decides; these apply
-- the decision atomically and refuse to apply it twice.
-- ---------------------------------------------------------------------------

-- Deal a week. With p_replace, re-deal one that nobody has ticked yet.
create function public.deal_week(
  p_house uuid,
  p_starts_on date,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_assignments jsonb,
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
  end if;

  insert into public.assignments (week_id, house_id, john_id, user_id, name, category, points, needs_photo, due_at)
  select week, p_house, (x ->> 'john_id')::uuid, (x ->> 'user_id')::uuid, x ->> 'name',
         x ->> 'category', (x ->> 'points')::smallint, coalesce((x ->> 'needs_photo')::boolean, false),
         (x ->> 'due_at')::timestamptz
  from jsonb_array_elements(p_assignments) x;

  update public.houses set first_dealt_at = coalesce(first_dealt_at, now()) where id = p_house;
  insert into public.events (house_id, kind, data)
  values (p_house, 'week_dealt', jsonb_build_object('starts_on', p_starts_on, 'count', jsonb_array_length(p_assignments)));
  return week;
end;
$$;

-- Stamp final outcomes and their forfeits together. p_items is
-- [{id, outcome, forfeit, month}]; already-settled rows are skipped.
create function public.settle_assignments(p_items jsonb)
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
      insert into public.ledger (house_id, user_id, kind, amount_minor, month, assignment_id)
      values (a.house_id, a.user_id, 'forfeit', -(x ->> 'forfeit')::integer, x ->> 'month', a.id)
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

-- Decide a dispute. Upheld strikes the tick: the John is open again if the
-- week is, and missed when it closes.
create function public.resolve_dispute(p_dispute uuid, p_resolution text)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  d public.disputes;
begin
  update public.disputes set resolution = p_resolution, resolved_at = now()
  where id = p_dispute and resolution is null
  returning * into d;
  if d.id is null then
    return false;
  end if;
  if p_resolution = 'upheld' then
    update public.assignments set done_at = null, photo_path = null
    where id = d.assignment_id and done_at = d.tick_at and outcome is null;
  end if;
  insert into public.events (house_id, kind, assignment_id, data)
  select d.house_id, p_resolution, d.assignment_id,
         jsonb_build_object('name', a.name, 'against', a.user_id)
  from public.assignments a where a.id = d.assignment_id;
  return true;
end;
$$;

-- Close a week and hand out what it earned. p_members is
-- [{user_id, streak, earn: ['immunity' | 'swap']}]. Tokens are added here,
-- under their caps, rather than written as totals, so a token someone spends
-- while the tick is running is never handed back.
create function public.close_week(p_week uuid, p_members jsonb)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  w public.weeks;
  x jsonb;
  perk text;
  member uuid;
begin
  update public.weeks set closed_at = now()
  where id = p_week and closed_at is null
  returning * into w;
  if w.id is null then
    return false;
  end if;
  for x in select * from jsonb_array_elements(p_members) loop
    member := (x ->> 'user_id')::uuid;
    update public.members set streak = (x ->> 'streak')::smallint
    where house_id = w.house_id and user_id = member;
    for perk in select jsonb_array_elements_text(coalesce(x -> 'earn', '[]'::jsonb)) loop
      if perk = 'immunity' then
        update public.members set immunity_tokens = immunity_tokens + 1
        where house_id = w.house_id and user_id = member and immunity_tokens < 2;
      elsif perk = 'swap' then
        update public.members set swap_tokens = swap_tokens + 1
        where house_id = w.house_id and user_id = member and swap_tokens < 1;
      else
        continue;
      end if;
      if found then
        insert into public.events (house_id, kind, user_id, data)
        values (w.house_id, perk || '_earned', member,
                jsonb_build_object('streak', (x ->> 'streak')::int, 'week', w.starts_on));
      end if;
    end loop;
  end loop;
  return true;
end;
$$;

-- Close a month: cap refunds and shares, once. p_entries is
-- [{user_id, kind, amount}].
create function public.close_month(p_house uuid, p_month text, p_entries jsonb)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  inserted text;
begin
  insert into public.month_closes (house_id, month) values (p_house, p_month)
  on conflict do nothing
  returning month into inserted;
  if inserted is null then
    return false;
  end if;
  insert into public.ledger (house_id, user_id, kind, amount_minor, month)
  select p_house, (x ->> 'user_id')::uuid, x ->> 'kind', (x ->> 'amount')::integer, p_month
  from jsonb_array_elements(p_entries) x
  where (x ->> 'amount')::integer <> 0;
  insert into public.events (house_id, kind, data)
  values (p_house, 'month_closed', jsonb_build_object('month', p_month));
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Stated, not inherited: nothing here depends on what the platform's
-- bootstrap happens to hand a new table.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;

grant select on
  public.profiles, public.houses, public.members, public.johns, public.weeks,
  public.assignments, public.disputes, public.dispute_votes, public.ledger,
  public.month_closes, public.events, public.reactions, public.push_subscriptions
to authenticated;

grant update (display_name) on public.profiles to authenticated;
grant update (name, timezone, currency, week_starts, stake_minor, late_forfeit_minor,
              missed_forfeit_minor, dispute_hours)
  on public.houses to authenticated;
grant insert (house_id, name, category, points, every_weeks, anchor_week, due_dow, due_time, needs_photo)
  on public.johns to authenticated;
grant update (name, category, points, every_weeks, due_dow, due_time, needs_photo, archived_at)
  on public.johns to authenticated;
grant insert (event_id, user_id, kind), delete on public.reactions to authenticated;
grant insert (user_id, endpoint, p256dh, auth), delete on public.push_subscriptions to authenticated;

-- Functions: the platform's default privileges hand EXECUTE to anon and
-- authenticated as well as PUBLIC, so all three come off and the housemate
-- API is granted back by name. The engine's functions (deal_week,
-- settle_assignments, resolve_dispute, close_week, close_month) are
-- service_role only. A later migration that adds a function must do the same.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.is_member(uuid), public.is_admin(uuid), public.shares_house(uuid),
  public.create_house(text, text, text, smallint), public.house_by_code(text),
  public.join_house(text), public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid), public.mark_done(uuid, text), public.undo_done(uuid),
  public.raise_dispute(uuid, text), public.cast_vote(uuid, boolean),
  public.use_immunity(uuid), public.use_swap(uuid, uuid),
  public.confirm_payment(uuid, uuid, integer)
to authenticated;
grant execute on all functions in schema public to service_role;

-- Live updates for the board and the Wall. Realtime applies the same RLS.
alter publication supabase_realtime add table
  public.events, public.assignments, public.disputes, public.dispute_votes;
