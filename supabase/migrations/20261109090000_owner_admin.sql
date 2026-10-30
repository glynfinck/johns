-- The owner's admin page, and the notices it puts at the top of the app
-- (docs/specs/owner-admin.md).
--
-- Who the owner is lives in app_owners, which nothing in the app can read or
-- write: only a migration adds or takes away a row. is_owner() is true for
-- an owner whose session has passed a second factor (aal2), and every admin
-- read and write checks it here, in the database, so the admin page is only
-- a window. Taking the row away locks the page at once: nothing is cached in
-- the token.
--
-- Every admin write goes through a function that writes admin_audit in the
-- same transaction, so nothing happens without its entry, and admin_audit
-- can only ever grow: no role may change or delete a row, the owner and the
-- service role included.
--
-- notices are the closable banners at the top of the app: a status (an
-- outage), an offer, or news. Anyone, signed in or not, reads the ones that
-- are on now; the owner reads them all. apps/api also keeps a copy outside
-- Supabase (Vercel Global Config), so a status notice still shows while the
-- database is down (GET /api/notices).

-- --- The owner -------------------------------------------------------------------------

create table public.app_owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.app_owners enable row level security;
-- No policies: nobody reads it through the API. is_owner() reads it as its owner.
revoke all on public.app_owners from public, anon, authenticated;
-- The API never writes it; the database tests make a stand-in owner with it.
grant select, insert, delete on public.app_owners to service_role;

-- Glyn, by both addresses he signs in with. Another owner, or a change of
-- account, is another migration.
insert into public.app_owners (user_id)
select id from auth.users where lower(email) in ('glynfinck@gmail.com', 'glynfinck97@gmail.com')
on conflict do nothing;

-- Is the caller the owner, with a second factor this session?
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_owners o where o.user_id = (select auth.uid()))
    and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;

-- What the admin page needs to know before it shows anything: is this the
-- owner, and have they passed a second factor yet? Anyone else gets
-- owner: false and nothing more, so the page looks like a missing one.
create or replace function public.owner_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'owner', exists (select 1 from public.app_owners o where o.user_id = (select auth.uid())),
    'mfa', coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
  );
$$;

-- --- The audit log ---------------------------------------------------------------------

create table public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  -- Who did it. Not a foreign key: deleting an account must never rewrite
  -- the log, which can only grow.
  actor uuid,
  -- What was done, as a short code: 'notice.save', 'notice.end'.
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  -- What it was done to.
  target_kind text not null,
  target_id text,
  reason text check (char_length(reason) <= 500),
  before jsonb,
  after jsonb
);

create index admin_audit_at on public.admin_audit (at desc);

alter table public.admin_audit enable row level security;
create policy "the owner reads the audit log" on public.admin_audit
  for select to authenticated using ((select public.is_owner()));

revoke all on public.admin_audit from public, anon, authenticated, service_role;
grant select on public.admin_audit to authenticated;
-- The API may add entries for what it does with the service role (refunds,
-- deletions: later PRs). Never change or delete them.
grant select, insert on public.admin_audit to service_role;

-- Append-only, whoever asks: even a role with every grant can't rewrite it.
create or replace function public.admin_audit_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_append_only' using errcode = '42501';
end;
$$;

create trigger admin_audit_append_only
  before update or delete on public.admin_audit
  for each row execute function public.admin_audit_append_only();
create trigger admin_audit_no_truncate
  before truncate on public.admin_audit
  for each statement execute function public.admin_audit_append_only();

-- --- Notices ---------------------------------------------------------------------------

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  -- status: something's wrong (hazard), offer: amber, news: plain.
  kind text not null check (kind in ('status', 'offer', 'news')),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  body text not null default '' check (char_length(body) <= 240),
  -- One action at most: a label and where it goes (a path in the app, or https).
  link_label text check (char_length(link_label) between 1 and 30),
  link_url text check (link_url ~ '^(/[^/\\]|/$|https://)' and char_length(link_url) <= 300),
  starts_at timestamptz not null default now(),
  -- Null: on until the owner ends it.
  ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((link_label is null) = (link_url is null)),
  check (ends_at is null or ends_at > starts_at)
);

create index notices_live on public.notices (starts_at, ends_at);

alter table public.notices enable row level security;
create policy "everyone reads the notices that are on" on public.notices
  for select to anon, authenticated
  using (starts_at <= now() and (ends_at is null or ends_at > now()));
create policy "the owner reads every notice" on public.notices
  for select to authenticated using ((select public.is_owner()));

revoke all on public.notices from public, anon, authenticated;
grant select on public.notices to anon, authenticated;
grant select on public.notices to service_role;

-- Write a notice, new (p_id null) or changed, and log it.
create or replace function public.save_notice(
  p_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_link_label text,
  p_link_url text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row public.notices;
  new_row public.notices;
begin
  if not public.is_owner() then
    raise exception 'owner_only' using errcode = '42501';
  end if;
  if p_ends_at is not null and p_ends_at <= coalesce(p_starts_at, now()) then
    raise exception 'notice_ends_first';
  end if;

  if p_id is null then
    insert into public.notices (kind, title, body, link_label, link_url, starts_at, ends_at, created_by)
    values (
      p_kind, btrim(p_title), coalesce(btrim(p_body), ''), nullif(btrim(p_link_label), ''),
      nullif(btrim(p_link_url), ''), coalesce(p_starts_at, now()), p_ends_at, auth.uid()
    )
    returning * into new_row;
  else
    select * into old_row from public.notices where id = p_id for update;
    if not found then
      raise exception 'not_found';
    end if;
    update public.notices set
      kind = p_kind,
      title = btrim(p_title),
      body = coalesce(btrim(p_body), ''),
      link_label = nullif(btrim(p_link_label), ''),
      link_url = nullif(btrim(p_link_url), ''),
      starts_at = coalesce(p_starts_at, old_row.starts_at),
      ends_at = p_ends_at,
      updated_at = now()
    where id = p_id
    returning * into new_row;
  end if;

  insert into public.admin_audit (actor, action, target_kind, target_id, before, after)
  values (
    auth.uid(), 'notice.save', 'notice', new_row.id::text,
    case when old_row.id is null then null else to_jsonb(old_row) end, to_jsonb(new_row)
  );
  return new_row.id;
end;
$$;

-- End a notice now (it stays, ended, for the record).
create or replace function public.end_notice(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row public.notices;
  new_row public.notices;
begin
  if not public.is_owner() then
    raise exception 'owner_only' using errcode = '42501';
  end if;
  select * into old_row from public.notices where id = p_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if old_row.ends_at is not null and old_row.ends_at <= now() then
    return;
  end if;
  update public.notices
  set ends_at = greatest(now(), starts_at + interval '1 second'), updated_at = now()
  where id = p_id
  returning * into new_row;

  insert into public.admin_audit (actor, action, target_kind, target_id, before, after)
  values (auth.uid(), 'notice.end', 'notice', p_id::text, to_jsonb(old_row), to_jsonb(new_row));
end;
$$;

revoke execute on function
  public.is_owner(),
  public.owner_status(),
  public.save_notice(uuid, text, text, text, text, text, timestamptz, timestamptz),
  public.end_notice(uuid),
  public.admin_audit_append_only()
from public, anon, authenticated;

grant execute on function
  public.is_owner(),
  public.owner_status(),
  public.save_notice(uuid, text, text, text, text, text, timestamptz, timestamptz),
  public.end_notice(uuid)
to authenticated;
grant execute on function public.is_owner(), public.owner_status() to service_role;
