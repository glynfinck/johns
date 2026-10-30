-- Settling up in Splitwise.
--
-- A house that already keeps its shared money in Splitwise can say so
-- (houses.settle_in). Month end works out who owes whom as before; then,
-- instead of waiting for the money to arrive, whoever is owed adds it in
-- Splitwise and marks it here, and Jonz stops asking. Jonz never talks to
-- Splitwise itself (its API isn't for paid apps without a licence): the
-- person copies the amount across.
--
-- Marking it is a payment in the ledger like any other, so balances, undo
-- and the Stake's history need nothing new. Only whoever is owed can mark
-- it, as with money received, and the Wall says which it was (events.data.via).

alter table public.houses add column settle_in text not null default 'jonz'
  check (settle_in in ('jonz', 'splitwise'));

-- An admin changes it with the rest of the rules (the houses update policy
-- is admins only).
grant update (settle_in) on public.houses to authenticated;

drop function public.confirm_payment(uuid, uuid, integer);

-- As 20261026183353's, plus p_via: null for money received, 'splitwise' for
-- a debt moved into Splitwise.
create function public.confirm_payment(p_house uuid, p_from uuid, p_amount integer, p_via text default null)
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
  if p_from = me or p_amount <= 0 or (p_via is not null and p_via <> 'splitwise')
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
  values (p_house, 'paid', p_from,
          jsonb_build_object('to', me, 'amount', p_amount)
            || case when p_via is null then '{}'::jsonb else jsonb_build_object('via', p_via) end);
end;
$$;

revoke execute on function public.confirm_payment(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.confirm_payment(uuid, uuid, integer, text) to authenticated, service_role;
