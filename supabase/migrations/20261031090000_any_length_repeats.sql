-- Johns that repeat on any period: every 1 to 26 weeks as before, or every 1
-- to 60 months (a year is 12) on a weekday of the month, like the fridge deep
-- clean on the first Saturday every 3 months.
--
-- A John that repeats in weeks keeps every_weeks and anchor_week. One that
-- repeats in months sets every_months, week_of_month (1 to 4, or 5 for the
-- last of its due day in the month) and anchor_month (a month it lands in,
-- counted as year * 12 + month - 1), and its every_weeks is left at 1. The
-- deal stays weekly: a monthly John is dealt in the week that holds its date
-- (@app/core repeat.ts, landsInWeek). A long John that is missed comes back
-- in the next deal (the engine, comesBack); nothing here.
--
-- Big jobs can weigh more: effort goes up to 20 points, on the list and on
-- what is dealt.

alter table public.johns drop constraint johns_every_weeks_check;
alter table public.johns add constraint johns_every_weeks_check check (every_weeks between 1 and 26);

alter table public.johns drop constraint johns_points_check;
alter table public.johns add constraint johns_points_check check (points between 1 and 20);
alter table public.assignments drop constraint assignments_points_check;
alter table public.assignments add constraint assignments_points_check check (points between 1 and 20);

alter table public.johns
  add column every_months smallint check (every_months between 1 and 60),
  add column week_of_month smallint check (week_of_month between 1 and 5),
  add column anchor_month integer;

-- A monthly John has all three; a weekly one none of the first two.
alter table public.johns add constraint johns_monthly_check check (
  (every_months is null) = (week_of_month is null)
  and (every_months is null or anchor_month is not null)
);

-- Admins write them as they write the rest of the list (RLS keeps it to admins).
grant insert (every_months, week_of_month, anchor_month), update (every_months, week_of_month, anchor_month)
  on public.johns to authenticated;
