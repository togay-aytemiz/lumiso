-- Phase 3: package delivery metadata and catalogued delivery methods

-- ----------------------------------------------------------------------
-- 1. Delivery method catalog per organization
-- ----------------------------------------------------------------------
create table if not exists public.package_delivery_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.package_delivery_methods enable row level security;

create policy "Org members can read package delivery methods"
  on public.package_delivery_methods
  for select
  using (
    organization_id in (
      select id from public.organizations
      where owner_id = auth.uid()
    )
  );

create policy "Org owners can manage package delivery methods"
  on public.package_delivery_methods
  for all
  using (
    organization_id in (
      select id from public.organizations
      where owner_id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select id from public.organizations
      where owner_id = auth.uid()
    )
  );

create index if not exists idx_package_delivery_methods_org
  on public.package_delivery_methods (organization_id, sort_order, name);

create unique index if not exists idx_package_delivery_methods_org_name_lower
  on public.package_delivery_methods (organization_id, lower(name));

create trigger trg_package_delivery_methods_updated_at
  before update on public.package_delivery_methods
  for each row execute function public.update_updated_at_column();

comment on table public.package_delivery_methods is
  'Reusable delivery method vocabulary for packages (e.g. Online gallery, USB drive).';
comment on column public.package_delivery_methods.name is
  'Display name shown in the package wizard.';

-- ----------------------------------------------------------------------
-- 2. Extend packages table with delivery metadata
-- ----------------------------------------------------------------------
alter table public.packages
  add column if not exists delivery_estimate_type text not null default 'single';

alter table public.packages
  add constraint packages_delivery_estimate_type_check
  check (delivery_estimate_type in ('single', 'range'));

alter table public.packages
  add column if not exists delivery_photo_count_min integer;

alter table public.packages
  add column if not exists delivery_photo_count_max integer;

alter table public.packages
  add column if not exists delivery_lead_time_value integer;

alter table public.packages
  add column if not exists delivery_lead_time_unit text;

alter table public.packages
  add constraint packages_delivery_lead_time_unit_check
  check (delivery_lead_time_unit is null or delivery_lead_time_unit in ('days', 'weeks'));

alter table public.packages
  add column if not exists delivery_methods jsonb not null default '[]'::jsonb;

comment on column public.packages.delivery_estimate_type is
  'Indicates whether the photo count estimate is a single number or a range.';
comment on column public.packages.delivery_photo_count_min is
  'Minimum number of photos promised when using a range estimate.';
comment on column public.packages.delivery_photo_count_max is
  'Maximum number of photos promised when using a range estimate.';
comment on column public.packages.delivery_lead_time_value is
  'Numeric portion of the delivery lead time (e.g. 3).';
comment on column public.packages.delivery_lead_time_unit is
  'Unit applied to the lead time value (days or weeks).';
comment on column public.packages.delivery_methods is
  'JSON array of delivery method objects { methodId, name }.';

-- ----------------------------------------------------------------------
-- 3. Helper to seed default delivery methods for an organization
-- ----------------------------------------------------------------------
create or replace function public.ensure_default_package_delivery_methods_for_org(
  org_id uuid,
  user_uuid uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  existing_count integer;
begin
  select count(*) into existing_count
  from public.package_delivery_methods
  where organization_id = org_id;

  if existing_count = 0 then
    insert into public.package_delivery_methods (organization_id, user_id, name, sort_order)
    values
      (org_id, user_uuid, 'Çevrim içi galeri', 10),
      (org_id, user_uuid, 'USB Bellek', 20),
      (org_id, user_uuid, 'Baskılı albüm', 30);
  end if;
end;
$function$;

comment on function public.ensure_default_package_delivery_methods_for_org is
  'Seeds a sensible delivery method catalogue for a newly created organization.';

-- ----------------------------------------------------------------------
-- 4. Update package seeding helper to ensure delivery methods exist
-- ----------------------------------------------------------------------
create or replace function public.ensure_default_packages_for_org(user_uuid uuid, org_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  package_count integer;
  online_gallery_id uuid;
  usb_drive_id uuid;
  printed_album_id uuid;
  wedding_album_id uuid;
  parent_album_id uuid;
  basic_retouch_id uuid;
  small_print_id uuid;
  slideshow_video_id uuid;
  usb_photos_id uuid;
  large_print_id uuid;
  wooden_frame_id uuid;
  premium_frame_id uuid;
begin
  select count(*) into package_count
  from public.packages
  where organization_id = org_id;

  if package_count = 0 then
    perform public.ensure_default_services_for_org(user_uuid, org_id);
    perform public.ensure_default_package_delivery_methods_for_org(org_id, user_uuid);

    select id into online_gallery_id from public.package_delivery_methods
      where organization_id = org_id and lower(name) = lower('Çevrim içi galeri') limit 1;
    select id into usb_drive_id from public.package_delivery_methods
      where organization_id = org_id and lower(name) = lower('USB Bellek') limit 1;
    select id into printed_album_id from public.package_delivery_methods
      where organization_id = org_id and lower(name) = lower('Baskılı albüm') limit 1;

    select id into wedding_album_id from public.services
      where organization_id = org_id and name = 'Standard Wedding Album' and is_sample = true limit 1;
    select id into parent_album_id from public.services
      where organization_id = org_id and name = 'Parent Album (smaller copy)' and is_sample = true limit 1;
    select id into basic_retouch_id from public.services
      where organization_id = org_id and name = 'Basic Retouch (per photo)' and is_sample = true limit 1;
    select id into small_print_id from public.services
      where organization_id = org_id and name = 'Small Print (13x18cm)' and is_sample = true limit 1;
    select id into slideshow_video_id from public.services
      where organization_id = org_id and name = 'Slideshow Video' and is_sample = true limit 1;
    select id into usb_photos_id from public.services
      where organization_id = org_id and name = 'USB with High-Resolution Photos' and is_sample = true limit 1;
    select id into large_print_id from public.services
      where organization_id = org_id and name = 'Large Print (50x70cm)' and is_sample = true limit 1;
    select id into wooden_frame_id from public.services
      where organization_id = org_id and name = 'Wooden Frame' and is_sample = true limit 1;
    select id into premium_frame_id from public.services
      where organization_id = org_id and name = 'Premium Frame (glass protected)' and is_sample = true limit 1;

    insert into public.packages (user_id, organization_id, name, description, price, applicable_types, default_add_ons, line_items, delivery_methods, is_active)
    values
      (
        user_uuid,
        org_id,
        'Wedding Standard',
        'Full day wedding coverage with essentials',
        15000,
        array['Wedding'],
        array[wedding_album_id::text, parent_album_id::text, basic_retouch_id::text],
        jsonb_build_array(
          jsonb_build_object('serviceId', wedding_album_id::text, 'role', 'addon', 'quantity', 1),
          jsonb_build_object('serviceId', parent_album_id::text, 'role', 'addon', 'quantity', 1),
          jsonb_build_object('serviceId', basic_retouch_id::text, 'role', 'addon', 'quantity', 1)
        ),
        jsonb_build_array(
          jsonb_build_object('methodId', online_gallery_id::text, 'name', 'Çevrim içi galeri')
        ),
        true
      ),
      (
        user_uuid,
        org_id,
        'Engagement Session',
        'Casual outdoor or studio engagement photoshoot',
        3500,
        array['Portrait'],
        array[small_print_id::text, slideshow_video_id::text],
        jsonb_build_array(
          jsonb_build_object('serviceId', small_print_id::text, 'role', 'addon', 'quantity', 1),
          jsonb_build_object('serviceId', slideshow_video_id::text, 'role', 'addon', 'quantity', 1)
        ),
        jsonb_build_array(
          jsonb_build_object('methodId', online_gallery_id::text, 'name', 'Çevrim içi galeri')
        ),
        true
      ),
      (
        user_uuid,
        org_id,
        'Newborn Session',
        'In-home newborn session with props and editing',
        4500,
        array['Newborn'],
        array[usb_photos_id::text, small_print_id::text],
        jsonb_build_array(
          jsonb_build_object('serviceId', usb_photos_id::text, 'role', 'addon', 'quantity', 1),
          jsonb_build_object('serviceId', small_print_id::text, 'role', 'addon', 'quantity', 1)
        ),
        jsonb_build_array(
          jsonb_build_object('methodId', printed_album_id::text, 'name', 'Baskılı albüm')
        ),
        true
      ),
      (
        user_uuid,
        org_id,
        'Baby Milestone Package',
        'Capture 3, 6, 12 month milestones',
        6500,
        array['Family', 'Newborn'],
        array[large_print_id::text, wedding_album_id::text],
        jsonb_build_array(
          jsonb_build_object('serviceId', large_print_id::text, 'role', 'addon', 'quantity', 1),
          jsonb_build_object('serviceId', wedding_album_id::text, 'role', 'addon', 'quantity', 1)
        ),
        jsonb_build_array(
          jsonb_build_object('methodId', usb_drive_id::text, 'name', 'USB Bellek')
        ),
        true
      ),
      (
        user_uuid,
        org_id,
        'Family Portrait',
        'Lifestyle family photography in studio or outdoor',
        3000,
        array['Family', 'Portrait'],
        array[wooden_frame_id::text, large_print_id::text],
        jsonb_build_array(
          jsonb_build_object('serviceId', wooden_frame_id::text, 'role', 'addon', 'quantity', 1),
          jsonb_build_object('serviceId', large_print_id::text, 'role', 'addon', 'quantity', 1)
        ),
        jsonb_build_array(
          jsonb_build_object('methodId', online_gallery_id::text, 'name', 'Çevrim içi galeri')
        ),
        true
      ),
      (
        user_uuid,
        org_id,
        'Event Coverage Standard',
        'Full coverage for corporate or private events',
        7500,
        array['Corporate', 'Event'],
        array[usb_photos_id::text, premium_frame_id::text],
        jsonb_build_array(
          jsonb_build_object('serviceId', usb_photos_id::text, 'role', 'addon', 'quantity', 1),
          jsonb_build_object('serviceId', premium_frame_id::text, 'role', 'addon', 'quantity', 1)
        ),
        jsonb_build_array(
          jsonb_build_object('methodId', usb_drive_id::text, 'name', 'USB Bellek')
        ),
        true
      );
  end if;
end;
$function$;
