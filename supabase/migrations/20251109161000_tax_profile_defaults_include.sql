-- Align organization tax profile defaults with VAT-inclusive pricing.

update public.organization_settings
set tax_profile = coalesce(tax_profile, '{}'::jsonb) ||
  jsonb_build_object(
    'defaultVatMode', 'inclusive',
    'pricesIncludeVat', true
  )
where coalesce(tax_profile ->> 'defaultVatMode', 'exclusive') <> 'inclusive'
   or coalesce((tax_profile ->> 'pricesIncludeVat')::boolean, false) = false;

with settings as (
  select
    organization_id,
    coalesce((tax_profile ->> 'defaultVatRate')::numeric, 20) as vat_rate,
    coalesce((tax_profile ->> 'pricesIncludeVat')::boolean, true) as prices_include_vat
  from public.organization_settings
)
update public.services s
set
  vat_rate = case
    when coalesce(s.vat_rate, 0) <= 0 then coalesce(settings.vat_rate, 20)
    else s.vat_rate
  end,
  price_includes_vat = coalesce(settings.prices_include_vat, true)
from settings
where s.organization_id = settings.organization_id
  and s.is_sample = true
  and (
    coalesce(s.vat_rate, 0) <= 0
    or s.price_includes_vat = false
  );

update public.services s
set
  vat_rate = case when coalesce(s.vat_rate, 0) <= 0 then 20 else s.vat_rate end,
  price_includes_vat = true
where s.is_sample = true
  and not exists (
    select 1
    from public.organization_settings os
    where os.organization_id = s.organization_id
  )
  and (
    coalesce(s.vat_rate, 0) <= 0
    or s.price_includes_vat = false
  );

create or replace function public.ensure_organization_settings(org_id uuid)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  settings_id uuid;
begin
  select id into settings_id
  from public.organization_settings
  where organization_id = org_id;

  if settings_id is null then
    insert into public.organization_settings (
      organization_id,
      date_format,
      time_format,
      photography_business_name,
      primary_brand_color,
      notification_overdue_reminder_enabled,
      notification_delivery_reminder_enabled,
      notification_session_reminder_enabled,
      notification_daily_summary_enabled,
      notification_task_nudge_enabled,
      notification_integration_failure_alert_enabled,
      notification_team_invite_accepted_alert_enabled,
      notification_delivery_reminder_send_at,
      notification_session_reminder_send_at,
      notification_daily_summary_send_at,
      tax_profile
    )
    values (
      org_id,
      'DD/MM/YYYY',
      '12-hour',
      '',
      '#1EB29F',
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      '09:00',
      '09:00',
      '07:00',
      jsonb_build_object(
        'legalEntityType', 'individual',
        'companyName', null,
        'taxOffice', null,
        'taxNumber', null,
        'billingAddress', null,
        'defaultVatRate', 20,
        'defaultVatMode', 'inclusive',
        'pricesIncludeVat', true
      )
    )
    returning id into settings_id;
  end if;

  return settings_id;
end;
$$;

create or replace function public.ensure_default_services_for_org(user_uuid uuid, org_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  sample_service_count integer;
  default_vat_rate numeric(5,2) := 20;
  prices_include_vat boolean := true;
begin
  select
    coalesce((tax_profile ->> 'defaultVatRate')::numeric, 20),
    coalesce((tax_profile ->> 'pricesIncludeVat')::boolean, true)
  into default_vat_rate, prices_include_vat
  from public.organization_settings
  where organization_id = org_id;

  if not found then
    default_vat_rate := 20;
    prices_include_vat := true;
  end if;

  select count(*) into sample_service_count
  from public.services
  where organization_id = org_id
    and is_sample = true;

  if sample_service_count = 0 then
    insert into public.services (
      user_id,
      organization_id,
      name,
      description,
      category,
      cost_price,
      selling_price,
      price,
      extra,
      is_sample,
      vat_rate,
      price_includes_vat
    )
    values
      (user_uuid, org_id, 'Standard Wedding Album', 'Professional wedding album with premium binding', 'Albums', 1500, 3000, 3000, false, true, default_vat_rate, prices_include_vat),
      (user_uuid, org_id, 'Parent Album (smaller copy)', 'Smaller copy of main album for parents', 'Albums', 800, 1500, 1500, false, true, default_vat_rate, prices_include_vat),
      (user_uuid, org_id, 'Large Print (50x70cm)', 'High-quality large format print', 'Prints', 200, 500, 500, false, true, default_vat_rate, prices_include_vat),
      (user_uuid, org_id, 'Small Print (13x18cm)', 'Standard size photo print', 'Prints', 20, 60, 60, false, true, default_vat_rate, prices_include_vat),
      (user_uuid, org_id, 'USB with High-Resolution Photos', 'All photos delivered on branded USB drive', 'Digital', 100, 300, 300, true, true, default_vat_rate, prices_include_vat),
      (user_uuid, org_id, 'Slideshow Video', 'Professional slideshow with music and transitions', 'Digital', 400, 1000, 1000, true, true, default_vat_rate, prices_include_vat),
      (user_uuid, org_id, 'Basic Retouch (per photo)', 'Basic color correction and exposure adjustment', 'Retouching', 30, 100, 100, false, true, default_vat_rate, prices_include_vat),
      (user_uuid, org_id, 'Advanced Retouch (skin, background)', 'Professional skin retouching and background editing', 'Retouching', 80, 200, 200, false, true, default_vat_rate, prices_include_vat),
      (user_uuid, org_id, 'Wooden Frame', 'Classic wooden frame for prints', 'Frames', 150, 400, 400, false, true, default_vat_rate, prices_include_vat),
      (user_uuid, org_id, 'Premium Frame (glass protected)', 'High-end frame with protective glass', 'Frames', 300, 700, 700, false, true, default_vat_rate, prices_include_vat);
  end if;
end;
$$;
