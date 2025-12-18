-- Admin-only helpers for managing galleries (preview access + archive/restore).

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
    on conflict (gallery_id, viewer_id)
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

create or replace function public.admin_set_gallery_archived(gallery_uuid uuid, archived boolean)
returns table (
  id uuid,
  status text,
  previous_status text
)
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  viewer uuid := auth.uid();
  updated_count int;
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

  if archived then
    return query
      update public.galleries g
      set
        status = 'archived',
        previous_status = case when g.status <> 'archived' then g.status else g.previous_status end,
        updated_at = now()
      where g.id = gallery_uuid
      returning g.id, g.status, g.previous_status;

    get diagnostics updated_count = row_count;
    if updated_count = 0 then
      raise exception 'gallery_not_found' using errcode = 'P0002';
    end if;
    return;
  end if;

  return query
    update public.galleries g
    set
      status = case
        when g.status = 'archived' then
          case
            when g.previous_status is not null and g.previous_status <> 'archived' then g.previous_status
            else case when g.published_at is null then 'draft' else 'published' end
          end
        else g.status
      end,
      previous_status = case when g.status = 'archived' then null else g.previous_status end,
      updated_at = now()
    where g.id = gallery_uuid
    returning g.id, g.status, g.previous_status;

  get diagnostics updated_count = row_count;
  if updated_count = 0 then
    raise exception 'gallery_not_found' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.admin_set_gallery_archived(uuid, boolean)
  is 'Admin-only: archive or restore a gallery while preserving previous status.';

