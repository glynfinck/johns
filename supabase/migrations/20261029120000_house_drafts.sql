-- Describe your house: an admin writes a sentence or two and Claude drafts
-- the John list (POST /api/setup/draft in apps/api). Each draft asked for is
-- one row here, so the API can hold a house to a few a day and we can see
-- what drafting costs. What the admin wrote is not kept, and nothing here
-- changes the John list: an admin keeps what they want of a draft through
-- the list's own column grants.

create table public.house_drafts (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  -- 'ai' when Claude drafted it; 'failed' when Claude was asked and didn't
  -- answer (a starter list stood in), so failures count toward the day too.
  outcome text not null check (outcome in ('ai', 'failed')),
  johns smallint not null default 0 check (johns >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  created_at timestamptz not null default now()
);

create index house_drafts_house_day on public.house_drafts (house_id, created_at);

-- Only the API writes and reads these, with the service role. Housemates
-- never see them.
alter table public.house_drafts enable row level security;
revoke all on public.house_drafts from public, anon, authenticated;
grant select, insert on public.house_drafts to service_role;
