-- Extend packages to support ordered service line items while keeping existing add-on arrays.
alter table public.packages
  add column if not exists line_items jsonb not null default '[]'::jsonb;

comment on column public.packages.line_items is 'Ordered list of services attached to the package, each with role (base/addon), quantity, and optional unitPrice overrides.';

-- Backfill existing rows so add-ons are mirrored as line-item entries.
update public.packages
set line_items = coalesce((
  select jsonb_agg(
           jsonb_build_object(
             'serviceId', service_id,
             'role', 'addon',
             'quantity', 1
           )
           order by ordinality
         )
  from unnest(coalesce(default_add_ons, array[]::text[])) with ordinality as t(service_id, ordinality)
), '[]'::jsonb)
where line_items = '[]'::jsonb;

-- Ensure helpers create packages with the new shape.
create or replace function public.ensure_default_packages(user_uuid uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  package_count integer;
begin
  select count(*) into package_count
  from public.packages
  where user_id = user_uuid;

  if package_count = 0 then
    insert into public.packages (user_id, name, description, price, applicable_types, default_add_ons, line_items, is_active)
    values
      (
        user_uuid,
        'Wedding Standard',
        'Full day wedding coverage with essentials',
        15000,
        array['Wedding', 'Engagement'],
        array[]::text[],
        '[]'::jsonb,
        true
      ),
      (
        user_uuid,
        'Engagement Session',
        'Casual outdoor or studio engagement photoshoot',
        3500,
        array['Engagement'],
        array[]::text[],
        '[]'::jsonb,
        true
      ),
      (
        user_uuid,
        'Newborn Session',
        'In-home newborn session with props and editing',
        4500,
        array['Newborn', 'Family'],
        array[]::text[],
        '[]'::jsonb,
        true
      ),
      (
        user_uuid,
        'Baby Milestone Package',
        'Capture 3, 6, 12 month milestones',
        6500,
        array['Baby', 'Family'],
        array[]::text[],
        '[]'::jsonb,
        true
      ),
      (
        user_uuid,
        'Family Portrait',
        'Lifestyle family photography in studio or outdoor',
        3000,
        array['Family', 'Portrait'],
        array[]::text[],
        '[]'::jsonb,
        true
      ),
      (
        user_uuid,
        'Event Coverage Standard',
        'Full coverage for corporate or private events',
        7500,
        array['Corporate', 'Event'],
        array[]::text[],
        '[]'::jsonb,
        true
      );
  end if;
end;
$function$;

create or replace function public.ensure_default_packages_for_org(user_uuid uuid, org_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  package_count integer;
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

    insert into public.packages (user_id, organization_id, name, description, price, applicable_types, default_add_ons, line_items, is_active)
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
        true
      );
  end if;
end;
$function$;
