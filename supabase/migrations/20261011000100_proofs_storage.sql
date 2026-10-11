-- ---------------------------------------------------------------------------
-- Photo receipts.
--
-- A private bucket. Objects live at `<house_id>/<assignment_id>/<file>`, and
-- the path is the whole of the access rule: housemates read anything under
-- their house, and only the person holding an open John may upload under it.
-- mark_done refuses a photo path outside that John's folder, so a receipt
-- cannot be borrowed from someone else's tick.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create function public.proof_house(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception
  when others then
    return null;
end;
$$;

create function public.can_upload_proof(object_name text)
returns boolean
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  parts text[] := storage.foldername(object_name);
  house uuid;
  assignment uuid;
begin
  if coalesce(array_length(parts, 1), 0) < 2 then
    return false;
  end if;
  begin
    house := parts[1]::uuid;
    assignment := parts[2]::uuid;
  exception
    when others then
      return false;
  end;
  return exists (
    select 1 from public.assignments a
    where a.id = assignment and a.house_id = house
      and a.user_id = (select auth.uid()) and a.outcome is null
  );
end;
$$;

create policy "housemates see proofs" on storage.objects
  for select to authenticated
  using (bucket_id = 'proofs' and public.is_member(public.proof_house(name)));

create policy "upload a proof for your own John" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proofs' and public.can_upload_proof(name));

revoke execute on function public.proof_house(text), public.can_upload_proof(text)
  from public, anon;
grant execute on function public.proof_house(text), public.can_upload_proof(text)
  to authenticated, service_role;
