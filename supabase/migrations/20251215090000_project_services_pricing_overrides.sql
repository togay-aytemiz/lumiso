-- Add per-project quantity and pricing overrides for services
alter table public.project_services
  add column if not exists quantity integer not null default 1 check (quantity >= 1);

alter table public.project_services
  add column if not exists unit_cost_override numeric(12,2);

alter table public.project_services
  add column if not exists unit_price_override numeric(12,2);

alter table public.project_services
  add column if not exists vat_rate_override numeric(5,2);

alter table public.project_services
  add column if not exists vat_mode_override text check (vat_mode_override in ('inclusive', 'exclusive'));

comment on column public.project_services.quantity is 'Number of units of this service included for the project.';
comment on column public.project_services.unit_cost_override is 'Optional project-specific override for service unit cost.';
comment on column public.project_services.unit_price_override is 'Optional project-specific override for service unit price.';
comment on column public.project_services.vat_rate_override is 'Optional project-specific override for service VAT rate (KDV).';
comment on column public.project_services.vat_mode_override is 'Optional project-specific override for how VAT is applied (inclusive/exclusive).';
