-- Enrich existing package line items with pricing and VAT metadata.
with expanded as (
  select
    p.id,
    elem.ordinality,
    elem.item,
    svc.selling_price,
    svc.price
  from public.packages as p
  cross join jsonb_array_elements(p.line_items) with ordinality as elem(item, ordinality)
  left join public.services as svc
    on svc.id::text = elem.item ->> 'serviceId'
),
enriched as (
  select
    id,
    jsonb_agg(
      (
        item
        || jsonb_build_object('unitPrice', computed.unit_price)
        || jsonb_build_object('vatMode', computed.vat_mode)
        || jsonb_build_object('vatRate', computed.vat_rate)
      )
      order by ordinality
    ) as line_items
  from expanded
  cross join lateral (
    select
      case
        when item ? 'unitPrice' and jsonb_typeof(item -> 'unitPrice') = 'number' then item -> 'unitPrice'
        when item ? 'unitPrice' and jsonb_typeof(item -> 'unitPrice') = 'string'
          and (item ->> 'unitPrice') ~ '^-?[0-9]+(\\.[0-9]+)?$'
          then to_jsonb((item ->> 'unitPrice')::numeric)
        when selling_price is not null then to_jsonb(selling_price)
        when price is not null then to_jsonb(price)
        else 'null'::jsonb
      end as unit_price,
      case
        when item ? 'vatMode' and item ->> 'vatMode' in ('inclusive', 'exclusive') then to_jsonb(item ->> 'vatMode')
        else to_jsonb('exclusive'::text)
      end as vat_mode,
      case
        when item ? 'vatRate' and jsonb_typeof(item -> 'vatRate') = 'number' then item -> 'vatRate'
        when item ? 'vatRate' and jsonb_typeof(item -> 'vatRate') = 'string'
          and (item ->> 'vatRate') ~ '^-?[0-9]+(\\.[0-9]+)?$'
          then to_jsonb((item ->> 'vatRate')::numeric)
        else 'null'::jsonb
      end as vat_rate
  ) as computed
  group by id
)
update public.packages as pkg
set line_items = enriched.line_items
from enriched
where pkg.id = enriched.id
  and enriched.line_items is not null
  and pkg.line_items <> enriched.line_items;

-- Ensure helper seeders include the richer line item payload.
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
          jsonb_build_object(
            'serviceId', wedding_album_id::text,
            'role', 'addon',
            'quantity', 1,
            'unitPrice', coalesce(
              (select selling_price from public.services where id = wedding_album_id),
              (select price from public.services where id = wedding_album_id),
              0
            ),
            'vatRate', null,
            'vatMode', 'exclusive'
          ),
          jsonb_build_object(
            'serviceId', parent_album_id::text,
            'role', 'addon',
            'quantity', 1,
            'unitPrice', coalesce(
              (select selling_price from public.services where id = parent_album_id),
              (select price from public.services where id = parent_album_id),
              0
            ),
            'vatRate', null,
            'vatMode', 'exclusive'
          ),
          jsonb_build_object(
            'serviceId', basic_retouch_id::text,
            'role', 'addon',
            'quantity', 1,
            'unitPrice', coalesce(
              (select selling_price from public.services where id = basic_retouch_id),
              (select price from public.services where id = basic_retouch_id),
              0
            ),
            'vatRate', null,
            'vatMode', 'exclusive'
          )
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
          jsonb_build_object(
            'serviceId', small_print_id::text,
            'role', 'addon',
            'quantity', 1,
            'unitPrice', coalesce(
              (select selling_price from public.services where id = small_print_id),
              (select price from public.services where id = small_print_id),
              0
            ),
            'vatRate', null,
            'vatMode', 'exclusive'
          ),
          jsonb_build_object(
            'serviceId', slideshow_video_id::text,
            'role', 'addon',
            'quantity', 1,
            'unitPrice', coalesce(
              (select selling_price from public.services where id = slideshow_video_id),
              (select price from public.services where id = slideshow_video_id),
              0
            ),
            'vatRate', null,
            'vatMode', 'exclusive'
          )
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
          jsonb_build_object(
            'serviceId', usb_photos_id::text,
            'role', 'addon',
            'quantity', 1,
            'unitPrice', coalesce(
              (select selling_price from public.services where id = usb_photos_id),
              (select price from public.services where id = usb_photos_id),
              0
            ),
            'vatRate', null,
            'vatMode', 'exclusive'
          ),
          jsonb_build_object(
            'serviceId', small_print_id::text,
            'role', 'addon',
            'quantity', 1,
            'unitPrice', coalesce(
              (select selling_price from public.services where id = small_print_id),
              (select price from public.services where id = small_print_id),
              0
            ),
            'vatRate', null,
            'vatMode', 'exclusive'
          )
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
          jsonb_build_object(
            'serviceId', large_print_id::text,
            'role', 'addon',
            'quantity', 1,
            'unitPrice', coalesce(
              (select selling_price from public.services where id = large_print_id),
              (select price from public.services where id = large_print_id),
              0
            ),
            'vatRate', null,
            'vatMode', 'exclusive'
          ),
          jsonb_build_object(
            'serviceId', wedding_album_id::text,
            'role', 'addon',
            'quantity', 1,
            'unitPrice', coalesce(
              (select selling_price from public.services where id = wedding_album_id),
              (select price from public.services where id = wedding_album_id),
              0
            ),
            'vatRate', null,
            'vatMode', 'exclusive'
          )
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
          jsonb_build_object(
            'serviceId', wooden_frame_id::text,
            'role', 'addon',
            'quantity', 1,
            'unitPrice', coalesce(
              (select selling_price from public.services where id = wooden_frame_id),
              (select price from public.services where id = wooden_frame_id),
              0
            ),
            'vatRate', null,
            'vatMode', 'exclusive'
          ),
          jsonb_build_object(
            'serviceId', large_print_id::text,
            'role', 'addon',
            'quantity', 1,
            'unitPrice', coalesce(
              (select selling_price from public.services where id = large_print_id),
              (select price from public.services where id = large_print_id),
              0
            ),
            'vatRate', null,
            'vatMode', 'exclusive'
          )
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
          jsonb_build_object(
            'serviceId', usb_photos_id::text,
            'role', 'addon',
            'quantity', 1,
            'unitPrice', coalesce(
              (select selling_price from public.services where id = usb_photos_id),
              (select price from public.services where id = usb_photos_id),
              0
            ),
            'vatRate', null,
            'vatMode', 'exclusive'
          ),
          jsonb_build_object(
            'serviceId', premium_frame_id::text,
            'role', 'addon',
            'quantity', 1,
            'unitPrice', coalesce(
              (select selling_price from public.services where id = premium_frame_id),
              (select price from public.services where id = premium_frame_id),
              0
            ),
            'vatRate', null,
            'vatMode', 'exclusive'
          )
        ),
        true
      );
  end if;
end;
$function$;
