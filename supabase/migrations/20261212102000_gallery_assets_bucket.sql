-- Private bucket for gallery proof assets (Phase 1: converted-only, PIN gate later via signed URLs)
insert into storage.buckets (id, name, public)
values ('gallery-assets', 'gallery-assets', false)
on conflict (id) do nothing;

drop policy if exists "Organization members can view gallery assets" on storage.objects;
drop policy if exists "Organization members can upload gallery assets" on storage.objects;
drop policy if exists "Organization members can update gallery assets" on storage.objects;
drop policy if exists "Organization members can delete gallery assets" on storage.objects;

drop policy if exists "Organization owners can view gallery assets" on storage.objects;
drop policy if exists "Organization owners can upload gallery assets" on storage.objects;
drop policy if exists "Organization owners can update gallery assets" on storage.objects;
drop policy if exists "Organization owners can delete gallery assets" on storage.objects;

create policy "Organization owners can view gallery assets"
on storage.objects for select
using (
  bucket_id = 'gallery-assets'
  and (storage.foldername(name))[1] in (
    select id::text
    from public.organizations
    where owner_id = auth.uid()
  )
);

create policy "Organization owners can upload gallery assets"
on storage.objects for insert
with check (
  bucket_id = 'gallery-assets'
  and auth.uid() is not null
  and (storage.foldername(name))[1] in (
    select id::text
    from public.organizations
    where owner_id = auth.uid()
  )
);

create policy "Organization owners can update gallery assets"
on storage.objects for update
using (
  bucket_id = 'gallery-assets'
  and (storage.foldername(name))[1] in (
    select id::text
    from public.organizations
    where owner_id = auth.uid()
  )
)
with check (
  bucket_id = 'gallery-assets'
  and (storage.foldername(name))[1] in (
    select id::text
    from public.organizations
    where owner_id = auth.uid()
  )
);

create policy "Organization owners can delete gallery assets"
on storage.objects for delete
using (
  bucket_id = 'gallery-assets'
  and (storage.foldername(name))[1] in (
    select id::text
    from public.organizations
    where owner_id = auth.uid()
  )
);
