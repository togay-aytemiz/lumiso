-- Packages pricing metadata enhancements

alter table public.packages
  add column if not exists client_total numeric;

alter table public.packages
  add column if not exists include_addons_in_price boolean default true;

alter table public.packages
  add column if not exists pricing_metadata jsonb default '{}'::jsonb;

update public.packages
set
  client_total = coalesce(client_total, price),
  include_addons_in_price = coalesce(include_addons_in_price, true),
  pricing_metadata = coalesce(pricing_metadata, '{}'::jsonb);

alter table public.packages
  alter column client_total set not null;

alter table public.packages
  alter column include_addons_in_price set not null;
