-- Normalize tax_profile payloads so freelance orgs are marked vatExempt with the correct defaults.
with profiles as (
  select
    id,
    coalesce(tax_profile, '{}'::jsonb) as profile,
    coalesce(tax_profile ->> 'legalEntityType', 'individual') as legal_entity
  from public.organization_settings
),
updates as (
  select
    id,
    profile,
    legal_entity,
    case
      when legal_entity = 'freelance' then true
      else coalesce((profile ->> 'vatExempt')::boolean, false)
    end as target_vat_exempt,
    case
      when legal_entity = 'freelance' then jsonb_build_object('defaultVatRate', 0, 'defaultVatMode', 'exclusive')
      else '{}'::jsonb
    end as entity_defaults
  from profiles
)
update public.organization_settings os
set tax_profile =
  updates.profile
  || jsonb_build_object('legalEntityType', updates.legal_entity)
  || jsonb_build_object('vatExempt', updates.target_vat_exempt)
  || updates.entity_defaults
from updates
where os.id = updates.id;

-- Surface intent that price_includes_vat is legacy-only; data is still preserved for historical reads.
comment on column public.services.price_includes_vat is
  'DEPRECATED: per-service VAT mode is derived from org defaults; this column remains only for legacy audit data.';
