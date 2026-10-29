-- Fixes from the security review of 2026-10-29.
--
-- 1. Someone an admin removes can't walk back in. The join code was the
--    whole of what it took to join and it never changed, so a removed
--    housemate (or anyone holding an old link from the group chat) could
--    join again whenever they liked. Now removing someone gives the house a
--    new code, and an admin can ask for a new one at any time
--    (reset_join_code), say after a link was posted somewhere public.
--
-- 2. Describe your house's daily limit holds. The API counted the day's
--    turns, asked Claude, and only then wrote the turn down, so a burst of
--    turns sent together all saw the same count and all went through; and
--    the limit was per house, so leaving and starting a new house began a
--    fresh day. claim_draft_turn now counts and writes the turn in one go,
--    under a lock, before Claude is asked, and holds each person to a
--    limit of their own as well as each house.
--
-- 3. A push subscription has to be a browser's push service. The endpoint
--    is whatever the browser hands over, and the API posts to it, so an
--    endpoint saved by hand could make the API post anywhere (and a slow one
--    hold up everyone's reminders). Only the push services browsers use are
--    accepted now.
--
-- 4. closes_at and cover_opens_at get a fixed search_path, as every other
--    function here has, and anon loses EXECUTE on cover_opens_at, which it
--    was handed by default.

-- --- 1. Join codes --------------------------------------------------------------------

-- A fresh code for the house. Admins only.
create function public.reset_join_code(p_house uuid)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  code text;
begin
  perform public.require_user();
  if not public.is_admin(p_house) then
    raise exception 'admins_only' using errcode = '42501';
  end if;
  update public.houses set join_code = public.new_join_code() where id = p_house
  returning join_code into code;
  return code;
end;
$$;

-- Leave, or (as an admin) ask someone to. Their history stays with the house.
-- The last one out closes it (see join_house). Someone asked to leave takes
-- the house's code with them: it changes, so their old link opens nothing.
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
  if found and p_user <> me then
    update public.houses set join_code = public.new_join_code() where id = p_house;
  end if;
end;
$$;

revoke execute on function public.reset_join_code(uuid), public.remove_member(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reset_join_code(uuid), public.remove_member(uuid, uuid)
  to authenticated, service_role;

-- --- 2. Describe your house's limit ------------------------------------------------------

-- Write down one turn, or refuse with draft_limit when the house or the
-- person has had their day's worth. The API calls this before it asks
-- Claude, then fills in how the turn went (an update, as the service role). Two locks,
-- house then person, so turns sent together are counted one at a time.
create function public.claim_draft_turn(p_house uuid, p_user uuid, p_house_limit integer, p_user_limit integer)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  since timestamptz := now() - interval '24 hours';
  turn uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('johns.drafts:' || p_house::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('johns.drafts.user:' || p_user::text, 0));
  if (select count(*) from public.house_drafts where house_id = p_house and created_at >= since) >= p_house_limit
     or (select count(*) from public.house_drafts where user_id = p_user and created_at >= since) >= p_user_limit then
    raise exception 'draft_limit';
  end if;
  insert into public.house_drafts (house_id, user_id, outcome) values (p_house, p_user, 'ai')
  returning id into turn;
  return turn;
end;
$$;

create index house_drafts_user_day on public.house_drafts (user_id, created_at);

grant update (outcome, johns, input_tokens, output_tokens) on public.house_drafts to service_role;

revoke execute on function public.claim_draft_turn(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_draft_turn(uuid, uuid, integer, integer) to service_role;

-- --- 3. Push endpoints ---------------------------------------------------------------------

-- Chrome, Edge (and everything built on Chromium), Firefox, Safari and the
-- old Edge. The path after the host is the service's own.
alter table public.push_subscriptions add constraint push_subscriptions_known_service check (
  endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
  and char_length(endpoint) <= 2048
);

-- --- 4. Search paths --------------------------------------------------------------------------

alter function public.closes_at(public.assignments, timestamptz) set search_path = '';
alter function public.cover_opens_at(public.assignments, timestamptz, smallint) set search_path = '';
revoke execute on function public.cover_opens_at(public.assignments, timestamptz, smallint) from public, anon;
