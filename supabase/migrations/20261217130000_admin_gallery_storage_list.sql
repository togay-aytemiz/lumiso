-- Admin helper for inspecting gallery storage usage.
-- Returns per-gallery storage usage (bytes) for a given organization.

create or replace function public.admin_list_galleries_with_storage(org_uuid uuid)
returns table (
  id uuid,
  title text,
  status text,
  type text,
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
  left join public.gallery_assets ga on ga.gallery_id = g.id
  where s.organization_id = org_uuid
    and public.has_role(auth.uid(), 'admin')
  group by g.id, g.title, g.status, g.type, g.created_at, g.updated_at
  order by g.updated_at desc nulls last;
$$;

comment on function public.admin_list_galleries_with_storage(uuid)
  is 'Admin-only: list galleries for an organization with computed storage usage (bytes).';

