-- Add VAT metadata to services and introduce organization tax profile defaults.

alter table public.services
  add column if not exists vat_rate numeric(5,2) not null default 0,
  add column if not exists price_includes_vat boolean not null default false;

comment on column public.services.vat_rate is 'Standard VAT (KDV) rate (%) applied to this service.';
comment on column public.services.price_includes_vat is 'Indicates whether the listed service prices already include VAT (KDV).';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_vat_rate_range'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_vat_rate_range
      check (vat_rate >= 0 and vat_rate <= 99.99);
  end if;
end
$$;

alter table public.organization_settings
  add column if not exists tax_profile jsonb;

comment on column public.organization_settings.tax_profile is 'Stores billing identity and default VAT (KDV) preferences for the organization.';

update public.organization_settings
set tax_profile = jsonb_build_object(
  'legalEntityType', coalesce(tax_profile ->> 'legalEntityType', 'individual'),
  'companyName', coalesce(tax_profile ->> 'companyName', photography_business_name),
  'taxOffice', coalesce(tax_profile ->> 'taxOffice', null),
  'taxNumber', coalesce(tax_profile ->> 'taxNumber', null),
  'billingAddress', coalesce(tax_profile ->> 'billingAddress', null),
  'defaultVatRate', 20,
  'defaultVatMode', coalesce(tax_profile ->> 'defaultVatMode', 'exclusive'),
  'pricesIncludeVat', coalesce((tax_profile ->> 'pricesIncludeVat')::boolean, false)
)
where coalesce(tax_profile, '{}'::jsonb) = '{}'::jsonb
   or coalesce((tax_profile ->> 'defaultVatRate')::numeric, 0) <= 0;

-- Ensure organization settings helper seeds the new defaults.
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
        'defaultVatMode', 'exclusive',
        'pricesIncludeVat', false
      )
    )
    returning id into settings_id;
  end if;

  return settings_id;
end;
$$;
