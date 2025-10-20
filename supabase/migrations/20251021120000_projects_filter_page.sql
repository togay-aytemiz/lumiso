-- Enable trigram extension for pattern matching on custom fields
create extension if not exists pg_trgm;

-- Ensure typed custom-field view exists for projects (gracefully handles absent tables)
do $$
begin
  if to_regclass('public.project_field_values') is not null
     and to_regclass('public.project_field_definitions') is not null then
    execute $$
      create or replace view public.project_field_values_typed as
      select
        v.project_id,
        p.organization_id,
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
          case lower(coalesce(v.value, ''))
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
      from public.project_field_values v
      join public.project_field_definitions d
        on d.field_key = v.field_key
      join public.projects p
        on p.id = v.project_id;
    $$;
  else
    execute $$
      create or replace view public.project_field_values_typed as
      select
        null::uuid as project_id,
        null::uuid as organization_id,
        null::text as field_key,
        null::text as value,
        null::text as field_type,
        null::numeric as value_number,
        null::date as value_date,
        null::boolean as value_bool
      where false;
    $$;
  end if;
end $$;

-- Helpful indexes for project custom fields if the base table exists
do $$
begin
  if to_regclass('public.project_field_values') is not null then
    execute $$create index if not exists idx_project_field_values_field_key on public.project_field_values (field_key);$$;
    execute $$create index if not exists idx_project_field_values_value_trgm on public.project_field_values using gin (value gin_trgm_ops);$$;
  end if;
end $$;

-- General purpose indexes to support filtering
create index if not exists idx_projects_org_id on public.projects (organization_id, id);
create index if not exists idx_projects_status_id on public.projects (status_id);
create index if not exists idx_sessions_project_id on public.sessions (project_id);
create index if not exists idx_todos_project_id on public.todos (project_id);
create index if not exists idx_project_services_project_id on public.project_services (project_id);
create index if not exists idx_payments_project_id on public.payments (project_id);

-- RPC for server-side filtered, paginated projects list
create or replace function public.projects_filter_page(
  org uuid,
  p_page int,
  p_size int,
  p_sort_field text,
  p_sort_dir text,
  p_scope text default 'active',
  p_filters jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  name text,
  description text,
  lead_id uuid,
  user_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  status_id uuid,
  project_type_id uuid,
  base_price numeric,
  sort_order int,
  lead jsonb,
  project_status jsonb,
  project_type jsonb,
  session_count int,
  planned_session_count int,
  upcoming_session_count int,
  next_session_date date,
  todo_count int,
  completed_todo_count int,
  open_todos jsonb,
  paid_amount numeric,
  remaining_amount numeric,
  services jsonb,
  total_count bigint
)
language sql
as $$
with params as (
  select
    coalesce(p_filters->'status_ids', '[]'::jsonb) as status_ids,
    coalesce(p_filters->'type_ids', '[]'::jsonb) as type_ids,
    coalesce(p_filters->'service_ids', '[]'::jsonb) as service_ids,
    nullif(coalesce(p_filters->>'session_presence', ''), '') as session_presence,
    nullif(coalesce(p_filters->>'progress', ''), '') as progress,
    nullif(coalesce(p_filters->>'balance_preset', ''), '') as balance_preset,
    nullif(coalesce(p_filters->>'balance_min', ''), '') as balance_min,
    nullif(coalesce(p_filters->>'balance_max', ''), '') as balance_max,
    coalesce(p_filters->'custom_fields', '{}'::jsonb) as custom_fields
),
status_filter as (
  select array(select value::uuid from jsonb_array_elements_text(params.status_ids)) as values
  from params
),
type_filter as (
  select array(select value::uuid from jsonb_array_elements_text(params.type_ids)) as values
  from params
),
service_filter as (
  select array(select value::uuid from jsonb_array_elements_text(params.service_ids)) as values
  from params
),
custom_filter_entries as (
  select key, value
  from params,
  jsonb_each(params.custom_fields)
),
custom_matches as (
  select v.project_id
  from custom_filter_entries f
  join public.project_field_values_typed v
    on v.field_key = f.key
   and v.organization_id = org
  where (
    (v.field_type = 'text' and v.value ilike '%' || (f.value->>'value') || '%')
    or (v.field_type = 'select' and exists (
      select 1
      from jsonb_array_elements_text(f.value->'values') sel
      where v.value ilike '%' || sel || '%'
    ))
    or (v.field_type = 'checkbox' and (
      (f.value->>'value') = 'any'
      or ((f.value->>'value') = 'checked' and v.value_bool is true)
      or ((f.value->>'value') = 'unchecked' and (v.value_bool is false or v.value_bool is null))
    ))
    or (v.field_type = 'date' and (
      (coalesce(f.value->>'start', '') = '' or v.value_date >= (f.value->>'start')::date)
      and (coalesce(f.value->>'end', '') = '' or v.value_date <= (f.value->>'end')::date)
    ))
    or (v.field_type = 'number' and (
      (coalesce(f.value->>'min', '') = '' or v.value_number >= (f.value->>'min')::numeric)
      and (coalesce(f.value->>'max', '') = '' or v.value_number <= (f.value->>'max')::numeric)
    ))
  )
  group by v.project_id
  having count(distinct v.field_key) = (select count(*) from custom_filter_entries)
),
session_counts as (
  select
    project_id,
    count(*) as total,
    count(*) filter (where lower(status) = 'planned') as planned,
    count(*) filter (where lower(status) = 'upcoming') as upcoming,
    min(session_date) filter (
      where lower(status) in ('planned', 'upcoming', 'confirmed')
    ) as next_date
  from public.sessions
  where project_id is not null
    and organization_id = org
  group by project_id
),
todo_counts as (
  select
    project_id,
    count(*) as total,
    count(*) filter (where is_completed) as completed,
    jsonb_agg(
      jsonb_build_object('id', id, 'content', content)
      order by created_at
    ) filter (where not is_completed) as open_items
  from public.todos
  where project_id is not null
  group by project_id
),
payment_totals as (
  select
    project_id,
    coalesce(sum(amount) filter (where lower(status) = 'paid'), 0)::numeric as paid_amount
  from public.payments
  where project_id is not null
    and (organization_id is null or organization_id = org)
  group by project_id
),
service_agg as (
  select
    ps.project_id,
    jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name) as services
  from public.project_services ps
  join public.services s on s.id = ps.service_id
  where s.organization_id is null or s.organization_id = org
  group by ps.project_id
),
base as (
  select
    p.*,
    l.name as lead_name,
    l.status as lead_status,
    l.email as lead_email,
    l.phone as lead_phone,
    st.name as status_name,
    st.color as status_color,
    st.sort_order as status_sort_order,
    pt.name as type_name,
    sc.total as session_total,
    sc.planned as session_planned,
    sc.upcoming as session_upcoming,
    sc.next_date as session_next_date,
    tc.total as todo_total,
    tc.completed as todo_completed,
    tc.open_items,
    pay.paid_amount,
    svc.services,
    sf.values as status_values,
    tf.values as type_values,
    svf.values as service_values
  from public.projects p
  left join public.leads l on l.id = p.lead_id
  left join public.project_statuses st on st.id = p.status_id
  left join public.project_types pt on pt.id = p.project_type_id
  left join session_counts sc on sc.project_id = p.id
  left join todo_counts tc on tc.project_id = p.id
  left join payment_totals pay on pay.project_id = p.id
  left join service_agg svc on svc.project_id = p.id
  cross join params
  left join status_filter sf on true
  left join type_filter tf on true
  left join service_filter svf on true
  where p.organization_id = org
    and (
      lower(coalesce(p_scope, 'active')) = 'archived'
        and lower(coalesce(st.name, '')) = 'archived'
      or lower(coalesce(p_scope, 'active')) <> 'archived'
        and lower(coalesce(st.name, '')) <> 'archived'
    )
    and (
      coalesce(array_length(sf.values, 1), 0) = 0
      or p.status_id = any(sf.values)
    )
    and (
      coalesce(array_length(tf.values, 1), 0) = 0
      or p.project_type_id = any(tf.values)
    )
    and (
      coalesce(array_length(svf.values, 1), 0) = 0
      or exists (
        select 1
        from public.project_services ps
        where ps.project_id = p.id
          and ps.service_id = any(svf.values)
      )
    )
    and (
      (select count(*) from custom_filter_entries) = 0
      or exists (
        select 1 from custom_matches m where m.project_id = p.id
      )
    )
),
filtered as (
  select
    base.*,
    (coalesce(base.base_price, 0)::numeric - coalesce(base.paid_amount, 0)::numeric) as remaining_amount
  from base
  where (
    params.session_presence is null or params.session_presence = ''
    or case params.session_presence
      when 'none' then coalesce(base.session_total, 0) = 0
      when 'hasAny' then coalesce(base.session_total, 0) > 0
      when 'hasPlanned' then coalesce(base.session_planned, 0) > 0
      when 'hasUpcoming' then coalesce(base.session_upcoming, 0) > 0
      else true
    end
  )
  and (
    params.progress is null or params.progress = ''
    or case params.progress
      when 'not_started' then coalesce(base.todo_total, 0) > 0 and coalesce(base.todo_completed, 0) = 0
      when 'in_progress' then coalesce(base.todo_total, 0) > 0 and coalesce(base.todo_completed, 0) > 0 and coalesce(base.todo_completed, 0) < coalesce(base.todo_total, 0)
      when 'completed' then coalesce(base.todo_total, 0) > 0 and coalesce(base.todo_completed, 0) = coalesce(base.todo_total, 0)
      else true
    end
  )
  and (
    params.balance_preset is null or params.balance_preset = ''
    or case params.balance_preset
      when 'zero' then abs(coalesce(base.base_price, 0)::numeric - coalesce(base.paid_amount, 0)::numeric) <= 0.01
      when 'due' then (coalesce(base.base_price, 0)::numeric - coalesce(base.paid_amount, 0)::numeric) > 0.01
      when 'credit' then (coalesce(base.base_price, 0)::numeric - coalesce(base.paid_amount, 0)::numeric) < -0.01
      else true
    end
  )
  and (
    params.balance_min is null or params.balance_min = ''
    or (coalesce(base.base_price, 0)::numeric - coalesce(base.paid_amount, 0)::numeric) >= (params.balance_min::numeric)
  )
  and (
    params.balance_max is null or params.balance_max = ''
    or (coalesce(base.base_price, 0)::numeric - coalesce(base.paid_amount, 0)::numeric) <= (params.balance_max::numeric)
  )
),
with_counts as (
  select
    filtered.*,
    jsonb_build_object(
      'id', filtered.lead_id,
      'name', filtered.lead_name,
      'status', filtered.lead_status,
      'email', filtered.lead_email,
      'phone', filtered.lead_phone
    ) as lead_json,
    jsonb_build_object(
      'id', filtered.status_id,
      'name', filtered.status_name,
      'color', filtered.status_color,
      'sort_order', filtered.status_sort_order
    ) as status_json,
    jsonb_build_object(
      'id', filtered.project_type_id,
      'name', filtered.type_name
    ) as type_json,
    coalesce(filtered.session_total, 0) as session_count,
    coalesce(filtered.session_planned, 0) as planned_session_count,
    coalesce(filtered.session_upcoming, 0) as upcoming_session_count,
    coalesce(filtered.todo_total, 0) as todo_count,
    coalesce(filtered.todo_completed, 0) as completed_todo_count,
    coalesce(filtered.open_items, '[]'::jsonb) as open_todos,
    coalesce(filtered.paid_amount, 0)::numeric as paid_amount_numeric,
    coalesce(filtered.services, '[]'::jsonb) as services_json,
    filtered.remaining_amount,
    count(*) over() as total_count
  from filtered
),
ordered as (
  select *
  from with_counts
  order by
    case when lower(p_sort_field) = 'name' and lower(p_sort_dir) = 'asc' then lower(name) end asc nulls last,
    case when lower(p_sort_field) = 'name' and lower(p_sort_dir) = 'desc' then lower(name) end desc nulls last,
    case when lower(p_sort_field) = 'lead_name' and lower(p_sort_dir) = 'asc' then lower(lead_name) end asc nulls last,
    case when lower(p_sort_field) = 'lead_name' and lower(p_sort_dir) = 'desc' then lower(lead_name) end desc nulls last,
    case when lower(p_sort_field) = 'project_type' and lower(p_sort_dir) = 'asc' then lower(type_name) end asc nulls last,
    case when lower(p_sort_field) = 'project_type' and lower(p_sort_dir) = 'desc' then lower(type_name) end desc nulls last,
    case when lower(p_sort_field) = 'status' and lower(p_sort_dir) = 'asc' then lower(status_name) end asc nulls last,
    case when lower(p_sort_field) = 'status' and lower(p_sort_dir) = 'desc' then lower(status_name) end desc nulls last,
    case when lower(p_sort_field) = 'created_at' and lower(p_sort_dir) = 'asc' then created_at end asc nulls last,
    case when lower(p_sort_field) = 'created_at' and lower(p_sort_dir) = 'desc' then created_at end desc nulls last,
    case when lower(p_sort_field) = 'updated_at' and lower(p_sort_dir) = 'asc' then updated_at end asc nulls last,
    case when lower(p_sort_field) = 'updated_at' and lower(p_sort_dir) = 'desc' then updated_at end desc nulls last,
    case when coalesce(lower(p_sort_field), '') not in ('name', 'lead_name', 'project_type', 'status', 'created_at', 'updated_at')
      and lower(coalesce(p_sort_dir, 'desc')) = 'asc' then updated_at end asc nulls last,
    case when coalesce(lower(p_sort_field), '') not in ('name', 'lead_name', 'project_type', 'status', 'created_at', 'updated_at')
      and lower(coalesce(p_sort_dir, 'desc')) <> 'asc' then updated_at end desc nulls last
  limit greatest(p_size, 1)
  offset greatest((p_page - 1) * greatest(p_size, 1), 0)
)
select
  id,
  name,
  description,
  lead_id,
  user_id,
  created_at,
  updated_at,
  status_id,
  project_type_id,
  base_price,
  sort_order,
  lead_json as lead,
  status_json as project_status,
  type_json as project_type,
  session_count,
  planned_session_count,
  upcoming_session_count,
  session_next_date as next_session_date,
  todo_count,
  completed_todo_count,
  open_todos,
  paid_amount_numeric as paid_amount,
  remaining_amount,
  services_json as services,
  total_count
from ordered;
$$;
