-- Enable trigram extension for faster ilike on text values
create extension if not exists pg_trgm;

-- Helper view to expose typed values for custom field filtering
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
join public.lead_field_definitions d
  on d.field_key = v.field_key
join public.leads l
  on l.id = v.lead_id;

-- Performance indexes for common lookups
-- Helpful indexes to support the view joins and lookups
create index if not exists idx_lead_field_values_field_key on public.lead_field_values (field_key);
create index if not exists idx_leads_org_id on public.leads (organization_id, id);

-- Trigram index to improve ilike searches on value
create index if not exists idx_lead_field_values_value_trgm
  on public.lead_field_values using gin (value gin_trgm_ops);
