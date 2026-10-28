-- The House Pass (docs/specs/house-pass.md).
--
-- One subscription per house, bought by any housemate, unlocks the extras
-- (the Stake, the Table and its perks, photo receipts, history beyond four
-- weeks) for everyone in it. The Pass lives on the house:
--
--   pass_plan   'trial' (the free month every new house gets), 'monthly',
--               'yearly', or 'founding' (for life: no end)
--   pass_until  when the Pass ends; null only for a Founding house
--   pass_buyer  who bought it, so the house can see who to thank and nobody
--               buys it twice; null for a trial or a Founding house given free
--
-- Only the service role writes these (the store webhook, later): there is
-- no column grant to authenticated, so an admin's update of the house
-- cannot touch them. Housemates read them through the house's select.
--
-- Nothing locks yet. @app/core's PASS_ENFORCED stays false until the store
-- release, and until then hasPass is never asked.

alter table public.houses
  add column pass_plan text not null default 'trial'
    check (pass_plan in ('trial', 'monthly', 'yearly', 'founding')),
  add column pass_until timestamptz default (now() + interval '30 days'),
  add column pass_buyer uuid references public.profiles (id) on delete set null;

-- Every house made before the House Pass existed already uses the Stake and
-- the Table, so it keeps them for life.
update public.houses set pass_plan = 'founding', pass_until = null;

alter table public.houses add constraint houses_pass_shape
  check ((pass_plan = 'founding') = (pass_until is null));
