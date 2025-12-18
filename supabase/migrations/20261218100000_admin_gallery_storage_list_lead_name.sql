-- Admin helper for inspecting gallery storage usage.
-- Returns per-gallery storage usage (bytes) and lead name for a given organization.

-- Note: Postgres does not allow changing a function's return type via CREATE OR REPLACE
-- when it uses OUT parameters, so we drop it first.
drop function if exists public.admin_list_galleries_with_storage(uuid);

create function public.admin_list_galleries_with_storage(org_uuid uuid)
returns table (
  id uuid,
  title text,
  status text,
  type text,
  lead_name text,
  created_at timestamptz,
  updated_at timestamptz,
  gallery_bytes bigint
)
language sql
stable
security definer
set search_path = 'public'
as $$
  select
    g.id,
    g.title,
    g.status,
    g.type,
    l.name as lead_name,
    g.created_at,
    g.updated_at,
    coalesce(
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
    )::bigint as gallery_bytes
  from public.galleries g
  join public.sessions s on s.id = g.session_id
  left join public.leads l on l.id = s.lead_id
  left join public.gallery_assets ga on ga.gallery_id = g.id
  where s.organization_id = org_uuid
    and public.has_role(auth.uid(), 'admin')
  group by g.id, g.title, g.status, g.type, l.name, g.created_at, g.updated_at
  order by g.updated_at desc nulls last;
$$;

comment on function public.admin_list_galleries_with_storage(uuid)
  is 'Admin-only: list galleries for an organization with computed storage usage (bytes) and lead name.';
