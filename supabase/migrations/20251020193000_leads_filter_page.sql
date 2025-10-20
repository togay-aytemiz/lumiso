-- RPC to return paginated, server-side filtered leads including total_count
-- Ensure typed view and indexes exist (idempotent)
create extension if not exists pg_trgm;

create or replace view public.lead_field_values_typed as
select
  v.lead_id,
  l.organization_id,
  v.field_key,
  v.value,
  d.field_type,
  case when d.field_type = 'number' then
    nullif(regexp_replace(coalesce(v.value, ''), '[^0-9\.-]', '', 'g'), '')::numeric
  else null end as value_number,
  case when d.field_type = 'date' then
    nullif(v.value, '')::date
  else null end as value_date,
  case when d.field_type = 'checkbox' then
    case lower(coalesce(v.value,''))
      when 'true' then true
      when '1' then true
      when 'yes' then true
      when 'y' then true
      when 'false' then false
      when '0' then false
      when 'no' then false
      when 'n' then false
      else null
    end
  else null end as value_bool
from public.lead_field_values v
join public.lead_field_definitions d on d.field_key = v.field_key
join public.leads l on l.id = v.lead_id;

create index if not exists idx_lead_field_values_field_key on public.lead_field_values (field_key);
create index if not exists idx_leads_org_id on public.leads (organization_id, id);
create index if not exists idx_lead_field_values_value_trgm on public.lead_field_values using gin (value gin_trgm_ops);

create or replace function public.leads_filter_page(
  org uuid,
  p_page int,
  p_size int,
  p_sort_field text,
  p_sort_dir text,
  p_status_ids uuid[] default null,
  p_filters jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  name text,
  email text,
  phone text,
  status text,
  status_id uuid,
  updated_at timestamptz,
  created_at timestamptz,
  lead_statuses jsonb,
  total_count bigint
)
language sql
as $$
with filters as (
  select * from jsonb_each(coalesce(p_filters, '{}'::jsonb))
),
matched as (
  select l.id as lead_id
  from public.leads l
  where l.organization_id = org
    and (p_status_ids is null or l.status_id = any(p_status_ids))
    and (
      (select count(*) from filters) = 0
      or l.id in (
        select v.lead_id
        from public.lead_field_values_typed v
        join filters f on v.field_key = f.key
        where v.organization_id = org
          and (
            -- text search
            (v.field_type = 'text' and v.value ilike '%' || (f.value->>'value') || '%')
            -- select options (any element matches)
            or (v.field_type = 'select' and exists (
              select 1 from jsonb_array_elements_text(f.value->'values') s
              where v.value ilike '%' || s || '%'
            ))
            -- checkbox
            or (v.field_type = 'checkbox' and (
              (f.value->>'value') = 'any'
              or ((f.value->>'value') = 'checked' and v.value_bool is true)
              or ((f.value->>'value') = 'unchecked' and (v.value_bool is false or v.value_bool is null))
            ))
            -- date range
            or (v.field_type = 'date' and (
              (coalesce(f.value->>'start','') = '' or v.value_date >= (f.value->>'start')::date)
              and (coalesce(f.value->>'end','') = '' or v.value_date <= (f.value->>'end')::date)
            ))
            -- number range
            or (v.field_type = 'number' and (
              (coalesce(f.value->>'min','') = '' or v.value_number >= (f.value->>'min')::numeric)
              and (coalesce(f.value->>'max','') = '' or v.value_number <= (f.value->>'max')::numeric)
            ))
          )
        group by v.lead_id
        having count(distinct v.field_key) = (select count(*) from filters)
      )
    )
),
base as (
  select l.*, to_jsonb(s.*) as status_json
  from public.leads l
  left join public.lead_statuses s on s.id = l.status_id
  join matched m on m.lead_id = l.id
  where l.organization_id = org
),
counted as (
  select *, count(*) over() as total_count
  from base
),
ordered as (
  select * from counted
  order by
    case when p_sort_field = 'name' and lower(p_sort_dir) = 'asc' then name end asc nulls last,
    case when p_sort_field = 'name' and lower(p_sort_dir) = 'desc' then name end desc nulls last,
    case when p_sort_field = 'created_at' and lower(p_sort_dir) = 'asc' then created_at end asc nulls last,
    case when p_sort_field = 'created_at' and lower(p_sort_dir) = 'desc' then created_at end desc nulls last,
    case when (p_sort_field is null or p_sort_field not in ('name','created_at')) and lower(p_sort_dir) = 'asc' then updated_at end asc nulls last,
    case when (p_sort_field is null or p_sort_field not in ('name','created_at')) and lower(p_sort_dir) = 'desc' then updated_at end desc nulls last
  limit p_size offset greatest((p_page - 1) * p_size, 0)
)
select id, name, email, phone, status, status_id, updated_at, created_at, status_json as lead_statuses, total_count
from ordered;
$$;
