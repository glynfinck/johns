-- Balances remember every week, not just the last 12.
--
-- A balance was the work done minus the share owed over the last 12 weeks.
-- Anything older dropped off whether or not it had been made up: a month
-- away fell out of the window just as it was paid back, so the weeks spent
-- catching up made the person look ahead and the debt came back, every 12
-- weeks, for good; and a regular coverer was never paid back in full
-- (@app/core fairness.test.ts runs both for five years).
--
-- This adds it all up in the database instead, so a long-lived house reads
-- one row per housemate rather than every week it has had. Counted as
-- @app/core deal.ts creditedTo does: a John counts for whoever covered it,
-- for nobody if it was missed, otherwise for whoever held it. Security
-- invoker: a housemate reads it through the same row-level security as the
-- rows it adds up, and the clock through its service role.
create or replace function public.house_balances(p_house uuid, p_before date)
returns table (user_id uuid, owed numeric, credited numeric)
language sql
stable
security invoker set search_path = ''
as $$
  with past as (
    select w.id from public.weeks w where w.house_id = p_house and w.starts_on < p_before
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
