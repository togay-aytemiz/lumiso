-- Fix ambiguous column reference in admin_grant_gallery_access.
-- The previous definition referenced ON CONFLICT (gallery_id, viewer_id) while
-- also returning a TABLE with the same column names, causing PL/pgSQL name
-- resolution errors. We avoid that by targeting a unique constraint instead.

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conname = 'gallery_access_grants_gallery_viewer_unique'
  ) then
    alter table public.gallery_access_grants
      add constraint gallery_access_grants_gallery_viewer_unique
      unique using index gallery_access_grants_gallery_viewer_unique;
  end if;
end;
$$;

create or replace function public.admin_grant_gallery_access(gallery_uuid uuid)
returns table (
  gallery_id uuid,
  viewer_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  viewer uuid := auth.uid();
  expires timestamptz := now() + interval '30 days';
begin
  if viewer is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.has_role(viewer, 'admin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if gallery_uuid is null then
    raise exception 'gallery_uuid_required' using errcode = '22023';
  end if;

  return query
    insert into public.gallery_access_grants (gallery_id, viewer_id, expires_at, updated_at)
    values (gallery_uuid, viewer, expires, now())
    on conflict on constraint gallery_access_grants_gallery_viewer_unique
    do update set
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
    returning
      gallery_access_grants.gallery_id,
      gallery_access_grants.viewer_id,
      gallery_access_grants.expires_at;
end;
$$;

comment on function public.admin_grant_gallery_access(uuid)
  is 'Admin-only: grant the current admin user temporary viewer access to a gallery (used for previewing).';
