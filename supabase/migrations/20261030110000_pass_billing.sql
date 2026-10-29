-- Buying the House Pass on the web (docs/specs/house-pass.md): Stripe
-- Checkout, then Stripe's webhook to apps/api, which writes the house's
-- pass_* columns. This row is how the webhook finds the house's Stripe
-- customer and its current subscription: an event for any other
-- subscription (an old one ending, say) leaves the Pass alone.

create table public.house_pass_billing (
  house_id uuid primary key references public.houses (id) on delete cascade,
  stripe_customer text not null,
  -- Null once the house holds no subscription: a Founding purchase, or
  -- before its first.
  stripe_subscription text,
  updated_at timestamptz not null default now()
);

-- Only the API reads and writes these, with the service role. Housemates
-- never see the Stripe ids.
alter table public.house_pass_billing enable row level security;
revoke all on public.house_pass_billing from public, anon, authenticated;
grant select, insert, update on public.house_pass_billing to service_role;
