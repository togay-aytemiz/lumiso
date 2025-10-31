-- Enhance services with visibility toggle and vendor metadata
alter table public.services
  add column if not exists is_active boolean not null default true,
  add column if not exists vendor_name text;

comment on column public.services.is_active is 'Controls whether the service is selectable in the app.';
comment on column public.services.vendor_name is 'Optional vendor or supplier information associated with the service.';
