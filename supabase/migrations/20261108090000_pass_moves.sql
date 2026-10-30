-- The Pass moves with the buyer (docs/specs/house-pass.md, "Moving out").
--
-- The House Pass belongs to whoever paid for it, and covers the house they
-- live in. When the buyer leaves a house themselves, the Pass goes with them:
--
-- 1. remove_member sets it aside on their moved_on row ('waiting'), with its
--    Stripe ids in moving_pass_billing, and the house they left keeps the
--    extras for 30 more days (a free month of its own, so it can buy a Pass).
-- 2. record_moved_on puts it on the next house they start or join, unless
--    that house has a Pass already ('moved'). Re-joining the old house
--    brings it back there.
-- 3. leave_pass, from the Moving on screen, leaves it with the old house
--    instead ('left'): it runs to the end of what was paid and stops
--    renewing (the clock tells Stripe, apps/api lib/pass/moves.ts).
-- 4. A Pass that waits more than 30 days stops renewing ('lapsed'); it can
--    still go on a house while what was paid for lasts.
--
-- A Pass moves at most once every 30 days, so one Pass can't hop between
-- friends' houses. Founding given free at launch (no buyer) stays put.

alter table public.moved_on
  add column pass_plan text check (pass_plan in ('monthly', 'yearly', 'founding')),
  -- When what was paid for ends (null for Founding); renewals move it on.
  add column pass_until timestamptz,
  add column pass_state text check (pass_state in ('waiting', 'moved', 'left', 'lapsed')),
  -- When it went on a house, the old one (left) or the next (moved).
  add column pass_placed_at timestamptz,
  -- When the clock told Stripe to stop renewing it.
  add column pass_stopped_at timestamptz,
  add check ((pass_plan is null) = (pass_state is null)),
  add check ((pass_plan = 'founding') = (pass_plan is not null and pass_until is null));

-- The Stripe side of a Pass on the move. Like house_pass_billing, only the
-- API reads it: nobody sees Stripe ids.
create table public.moving_pass_billing (
  move_id uuid primary key references public.moved_on (id) on delete cascade,
  stripe_customer text not null,
  stripe_subscription text
);

create index moving_pass_billing_subscription on public.moving_pass_billing (stripe_subscription);

alter table public.moving_pass_billing enable row level security;
revoke all on public.moving_pass_billing from public, anon, authenticated;
grant select, insert, update, delete on public.moving_pass_billing to service_role;

-- Put a Pass that's with someone on a house: the house's Pass and billing
-- become it. Callers check the house can take it.
create function public.place_pass(p_move uuid, p_house uuid, p_state text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  o public.moved_on;
  bill public.moving_pass_billing;
begin
  select * into o from public.moved_on where id = p_move;
  update public.houses
  set pass_plan = o.pass_plan, pass_until = o.pass_until, pass_buyer = o.user_id
  where id = p_house;
  select * into bill from public.moving_pass_billing where move_id = p_move;
  if bill.move_id is not null then
    insert into public.house_pass_billing (house_id, stripe_customer, stripe_subscription)
    values (p_house, bill.stripe_customer, bill.stripe_subscription)
    on conflict (house_id) do update
      set stripe_customer = excluded.stripe_customer,
        stripe_subscription = excluded.stripe_subscription,
        updated_at = now();
  end if;
  update public.moved_on set pass_state = p_state, pass_placed_at = now() where id = p_move;
end;
$$;

-- Whether a house holds a Pass someone paid for (or Founding): one a Pass
-- on the move doesn't replace. A free month doesn't count.
create function public.house_has_paid_pass(p_house uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.houses
    where id = p_house
      and (pass_plan = 'founding' or (pass_plan in ('monthly', 'yearly') and pass_until > now()))
  );
$$;

-- Leave, or (as an admin) ask someone to. As 20261107090000, and now the
-- buyer who leaves themselves takes the Pass with them.
create or replace function public.remove_member(p_house uuid, p_user uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  leaving public.members;
  h public.houses;
  move uuid;
  grace timestamptz;
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
    insert into public.moved_on (user_id, from_house) values (p_user, p_house) returning id into move;

    -- The buyer leaving themselves takes the Pass, unless it moved in the last 30 days.
    select * into h from public.houses where id = p_house for update;
    if p_user = me and h.pass_buyer = me and public.house_has_paid_pass(p_house)
      and not exists (
        select 1 from public.moved_on
        where user_id = me and pass_state = 'moved' and pass_placed_at > now() - interval '30 days'
      )
    then
      update public.moved_on
      set pass_plan = h.pass_plan, pass_until = h.pass_until, pass_state = 'waiting'
      where id = move;
      insert into public.moving_pass_billing (move_id, stripe_customer, stripe_subscription)
      select move, b.stripe_customer, b.stripe_subscription
      from public.house_pass_billing b where b.house_id = p_house;
      delete from public.house_pass_billing where house_id = p_house;
      -- The house keeps the extras for 30 days (no longer than was paid for), as a free month it can buy from.
      grace := least(coalesce(h.pass_until, 'infinity'), now() + interval '30 days');
      update public.houses set pass_plan = 'trial', pass_until = grace, pass_buyer = null where id = p_house;
    end if;

    -- Their name goes with the post: once they've gone, the Wall can't look it up.
    -- With the Pass gone too, the day the house's extras last until.
    if exists (select 1 from public.members where house_id = p_house) then
      insert into public.events (house_id, kind, user_id, data)
      select p_house, 'moved_out', p_user,
        jsonb_build_object('who', p.display_name)
          || case when grace is null then '{}'::jsonb else jsonb_build_object('pass_until', (grace at time zone h.timezone)::date) end
      from public.profiles p where p.id = p_user;
    end if;
  end if;
end;
$$;

-- Fill in where someone went next, as 20261107090000, and put a Pass
-- they're carrying on the house: one they start, join or come back to,
-- unless it has a Pass of its own already (then the Pass keeps waiting).
create or replace function public.record_moved_on(p_user uuid, p_to uuid, p_how text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  carried public.moved_on;
begin
  update public.moved_on set to_house = p_to, how = p_how, moved_at = now()
  where id = (
    select id from public.moved_on
    where user_id = p_user and how is null and from_house <> p_to
    order by left_at desc
    limit 1
  );
  select * into carried from public.moved_on
  where user_id = p_user and pass_state in ('waiting', 'lapsed')
    and (pass_plan = 'founding' or pass_until > now())
  order by left_at desc
  limit 1;
  if carried.id is not null and not public.house_has_paid_pass(p_to) then
    perform public.place_pass(carried.id, p_to, 'moved');
  end if;
end;
$$;

-- "Leave it for the house": the Pass you're carrying goes back to the house
-- you left, to the end of what was paid (the clock stops it renewing). If
-- that house has bought a Pass of its own since, yours just stops renewing.
create function public.leave_pass()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
  o public.moved_on;
begin
  select * into o from public.moved_on
  where user_id = me and pass_state = 'waiting'
  order by left_at desc
  limit 1
  for update;
  if o.id is null then
    raise exception 'no_pass_to_leave';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('johns.members:' || o.from_house::text, 0));
  if public.house_has_paid_pass(o.from_house) then
    update public.moved_on set pass_state = 'left' where id = o.id;
  else
    perform public.place_pass(o.id, o.from_house, 'left');
  end if;
end;
$$;

-- What the Moving on screen offers, as 20261107090000, and now the Pass
-- you're carrying (null without one) and the day (the house's own) until
-- which the house you left keeps the extras.
drop function public.moving_on();
create function public.moving_on()
returns table (
  from_house uuid,
  house_name text,
  johns bigint,
  left_at timestamptz,
  pass_plan text,
  pass_state text,
  house_pass_until date
)
language sql
stable
security definer set search_path = ''
as $$
  select o.from_house, h.name,
    (select count(*) from public.johns j where j.house_id = o.from_house and j.archived_at is null),
    o.left_at, o.pass_plan, o.pass_state,
    case when h.pass_plan = 'trial' then (h.pass_until at time zone h.timezone)::date end
  from public.moved_on o join public.houses h on h.id = o.from_house
  where o.user_id = auth.uid() and o.how is null and o.left_at > now() - interval '90 days'
  order by o.left_at desc
  limit 1;
$$;

revoke execute on function
  public.place_pass(uuid, uuid, text), public.house_has_paid_pass(uuid),
  public.remove_member(uuid, uuid), public.record_moved_on(uuid, uuid, text),
  public.leave_pass(), public.moving_on()
from public, anon, authenticated;
grant execute on function public.remove_member(uuid, uuid), public.leave_pass(), public.moving_on()
to authenticated, service_role;
grant execute on function
  public.place_pass(uuid, uuid, text), public.house_has_paid_pass(uuid), public.record_moved_on(uuid, uuid, text)
to service_role;
