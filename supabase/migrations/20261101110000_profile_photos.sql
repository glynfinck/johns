-- ---------------------------------------------------------------------------
-- Profile photos from sign-in.
--
-- Avatars show the photo of the account you signed in with, falling back to
-- initials. Google hands its photo over with every sign-in; Microsoft
-- doesn't, so the app reads it from Microsoft Graph once you've signed in
-- and keeps a copy in the public `avatars` bucket.
--
-- 1. A profile follows its sign-in photo. The photo comes from the
--    identity's own data (auth.identities), which only the sign-in provider
--    writes, never from user_metadata, which anyone may set for themselves.
--    Signing in again picks up a changed photo; an identity with no photo
--    (Microsoft's) leaves the profile's alone.
--
-- 2. The `avatars` bucket: anyone may look (an <img> can't send a token),
--    and you may only write under your own folder, `<user_id>/`.
--
-- 3. set_my_photo: point your profile at a photo in your own folder. The
--    one way a profile's photo changes from the app.
-- ---------------------------------------------------------------------------

-- --- 1. Following the sign-in photo ----------------------------------------------------

-- An identity's photo: Google's is `avatar_url` (and `picture`). Web addresses only.
create function public.identity_photo(data jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select photo from (
    select coalesce(nullif(btrim(data ->> 'avatar_url'), ''), nullif(btrim(data ->> 'picture'), '')) as photo
  ) p
  where photo ~ '^https://';
$$;

create function public.follow_identity_photo()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  photo text := public.identity_photo(new.identity_data);
begin
  if photo is not null then
    update public.profiles
    set avatar_url = photo
    where id = new.user_id and avatar_url is distinct from photo;
  end if;
  return new;
end;
$$;

create trigger on_auth_identity_photo
  after insert or update of identity_data on auth.identities
  for each row execute function public.follow_identity_photo();

revoke execute on function public.follow_identity_photo(), public.identity_photo(jsonb) from public, anon, authenticated;

-- Everyone who signed in before this, from their identities' photos.
update public.profiles p
set avatar_url = i.photo
from (
  select distinct on (user_id) user_id, public.identity_photo(identity_data) as photo
  from auth.identities
  where public.identity_photo(identity_data) is not null
  order by user_id, last_sign_in_at desc nulls last
) i
where p.id = i.user_id and p.avatar_url is distinct from i.photo;

-- --- 2. The avatars bucket ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Overwriting your photo (upsert) needs select and update as well as insert.
create policy "see your own photo" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "upload your own photo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "replace your own photo" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- --- 3. set_my_photo -------------------------------------------------------------------

-- `photo`: the avatars bucket's public address for a file in your own folder,
-- with an optional ?v= so a new photo isn't served from a cache.
create function public.set_my_photo(photo text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if photo is null or photo !~ (
    '^(https://[^/?#]+|http://(127\.0\.0\.1|localhost)(:[0-9]+)?)/storage/v1/object/public/avatars/'
    || me::text || '/[A-Za-z0-9][A-Za-z0-9._-]*(\?v=[0-9]+)?$'
  ) then
    raise exception 'That photo isn''t yours.' using errcode = '22023';
  end if;
  update public.profiles set avatar_url = photo where id = me;
end;
$$;

revoke execute on function public.set_my_photo(text) from public, anon;
grant execute on function public.set_my_photo(text) to authenticated, service_role;
