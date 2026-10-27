-- What a payment can settle: only what's owed for real.
--
-- confirm_payment checked a payment against each side's whole ledger, this
-- month's forfeits included. But a month's forfeits aren't owed to anyone
-- until the month closes and they're shared out; the app (core's
-- buildStake) offers to settle only closed months, after the payments made
-- against them. So a payee who had forfeited anything this month was
-- refused for the very amount the app offered ("Tom owes you £4.01": Mark
-- £4.01 received, more_than_owed). Both sides now count what the app
-- counts: every payment, and every entry of a closed month.

create or replace function public.confirm_payment(p_house uuid, p_from uuid, p_amount integer)
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
  select coalesce(sum(l.amount_minor), 0) into mine
  from public.ledger l
  where l.house_id = p_house and l.user_id = me
    and (l.kind = 'payment'
         or exists (select 1 from public.month_closes c where c.house_id = p_house and c.month = l.month));
  select coalesce(sum(l.amount_minor), 0) into theirs
  from public.ledger l
  where l.house_id = p_house and l.user_id = p_from
    and (l.kind = 'payment'
         or exists (select 1 from public.month_closes c where c.house_id = p_house and c.month = l.month));
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

-- Replacing a function keeps its grants; said again here so this file stands alone.
revoke execute on function public.confirm_payment(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.confirm_payment(uuid, uuid, integer) to authenticated, service_role;
