-- Convenience function for displaying gallery vs. total storage usage in the UI.
-- Uses gallery_assets metadata (proofSize) and is scoped to the org(s) owned by the caller.
create or replace function public.get_gallery_storage_usage(gallery_uuid uuid)
returns table (gallery_bytes bigint, org_bytes bigint)
language sql
stable
security definer
set search_path = 'public'
as $$
  with owner_orgs as (
    select id as organization_id
    from public.organizations
    where owner_id = auth.uid()
  ),
  target_org as (
    select s.organization_id
    from public.galleries g
    join public.sessions s on s.id = g.session_id
    where g.id = gallery_uuid
    limit 1
  ),
  allowed_org as (
    select o.organization_id
    from owner_orgs o
    join target_org t on t.organization_id = o.organization_id
  ),
  gallery_sum as (
    select coalesce(
      sum(
        case
          when ga.status = 'ready'
            and ga.metadata ? 'proofSize'
            and (ga.metadata->>'proofSize') ~ '^[0-9]+$'
            then (ga.metadata->>'proofSize')::bigint
          else 0
        end
      ),
      0
    )::bigint as bytes
    from public.gallery_assets ga
    where ga.gallery_id = gallery_uuid
  ),
  org_sum as (
    select coalesce(
      sum(
        case
          when ga.status = 'ready'
            and ga.metadata ? 'proofSize'
            and (ga.metadata->>'proofSize') ~ '^[0-9]+$'
            then (ga.metadata->>'proofSize')::bigint
          else 0
        end
      ),
      0
    )::bigint as bytes
    from public.gallery_assets ga
    join public.galleries g on g.id = ga.gallery_id
    join public.sessions s on s.id = g.session_id
    join allowed_org ao on ao.organization_id = s.organization_id
  )
  select gallery_sum.bytes as gallery_bytes, org_sum.bytes as org_bytes
  from gallery_sum, org_sum
  where exists (select 1 from allowed_org);
$$;

