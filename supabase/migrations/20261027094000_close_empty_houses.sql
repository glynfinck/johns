-- A house with nobody left in it is closed.
--
-- The last one out could leave, and the house stayed behind with its join
-- code still working. Whoever used that code next (a new housemate months
-- later, or a stranger with an old link from the group chat) walked into an
-- empty house as a plain member: no admin to deal the week or set the stake,
-- and every past housemate's history in view. Now an empty house's code
-- opens nothing: house_by_code finds no house, and join_house refuses with
-- unknown_code, the bad link the app already explains. The house and its
-- history stay in the database, out of reach; anyone who wants a house
-- again starts a new one. Houses that are empty already are covered too.
--
-- The member count can only be trusted while it can't change underneath,
-- so the three moves that change who is in a house, and as what, now take
-- one lock per house and go one at a time. Otherwise a newcomer could join
-- in the instant the last one out was leaving and end up alone with no
-- admin; or two admins leaving (or stepping down) at once could each see
-- the other as the admin who stays.

create or replace function public.house_by_code(p_code text)
returns table (id uuid, name text, members bigint)
language sql
stable
security definer set search_path = ''
as $$
  select h.id, h.name, (select count(*) from public.members m where m.house_id = h.id)
  from public.houses h
  where h.join_code = upper(btrim(p_code)) and auth.uid() is not null
    and exists (select 1 from public.members m where m.house_id = h.id);
$$;

create or replace function public.join_house(p_code text)
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
  perform pg_advisory_xact_lock(hashtextextended('johns.members:' || house::text, 0));
  if not exists (select 1 from public.members where house_id = house) then
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
create or replace function public.set_member_role(p_house uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.require_user();
  perform pg_advisory_xact_lock(hashtextextended('johns.members:' || p_house::text, 0));
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
-- The last one out closes it (see join_house).
create or replace function public.remove_member(p_house uuid, p_user uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := public.require_user();
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
  delete from public.members where house_id = p_house and user_id = p_user;
end;
$$;

-- Replacing a function keeps its grants; said again here so this file stands alone.
revoke execute on function
  public.house_by_code(text), public.join_house(text),
  public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid)
from public, anon, authenticated;
grant execute on function
  public.house_by_code(text), public.join_house(text),
  public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid)
to authenticated, service_role;
