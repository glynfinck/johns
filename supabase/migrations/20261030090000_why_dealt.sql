-- Why each John went where it did. The deal (@app/core deal.ts,
-- fairSharesExplained) keeps what it weighed with each assignment it deals:
-- who it went to, what decided it, where each sharer home that day stood
-- against their share, and who was away. The John sheet's "Why?" reads it,
-- so it says what the deal actually did rather than replaying it. Null on a
-- John dealt before this, and on a flag (it goes to whoever is on call).

alter table public.assignments add column dealt jsonb;

-- Deal a week: as before (20261027220000_on_call_johns.sql), keeping each
-- assignment's dealt.
create or replace function public.deal_week(
  p_house uuid,
  p_starts_on date,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_assignments jsonb,
  p_shares jsonb,
  p_replace boolean default false,
  p_on_call jsonb default '[]'::jsonb
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
      where week_id = week and (done_at is not null or outcome is not null or flagged_at is not null)
    ) then
      raise exception 'week_started';
    end if;
    delete from public.assignments where week_id = week;
    delete from public.week_shares where week_id = week;
    delete from public.on_call where week_id = week;
  end if;

  insert into public.assignments
    (week_id, house_id, john_id, user_id, name, category, points, needs_photo, due_at, group_name, dealt)
  select week, p_house, (x ->> 'john_id')::uuid, (x ->> 'user_id')::uuid, x ->> 'name',
         x ->> 'category', (x ->> 'points')::smallint, coalesce((x ->> 'needs_photo')::boolean, false),
         (x ->> 'due_at')::timestamptz, x ->> 'group_name', x -> 'dealt'
  from jsonb_array_elements(p_assignments) x;

  insert into public.week_shares (week_id, house_id, user_id, share)
  select week, p_house, (x ->> 'user_id')::uuid, (x ->> 'share')::numeric
  from jsonb_array_elements(p_shares) x;

  insert into public.on_call (week_id, house_id, john_id, user_id)
  select week, p_house, (x ->> 'john_id')::uuid, (x ->> 'user_id')::uuid
  from jsonb_array_elements(p_on_call) x;

  update public.houses set first_dealt_at = coalesce(first_dealt_at, now()) where id = p_house;
  insert into public.events (house_id, kind, data)
  values (p_house, 'week_dealt', jsonb_build_object(
    'starts_on', p_starts_on,
    'count', jsonb_array_length(p_assignments) + jsonb_array_length(p_on_call)
  ));
  return week;
end;
$$;

-- Replacing a function keeps its grants; said again here so this file stands alone.
revoke execute on function
  public.deal_week(uuid, date, timestamptz, timestamptz, jsonb, jsonb, boolean, jsonb)
from public, anon, authenticated;
grant execute on function
  public.deal_week(uuid, date, timestamptz, timestamptz, jsonb, jsonb, boolean, jsonb)
to service_role;
