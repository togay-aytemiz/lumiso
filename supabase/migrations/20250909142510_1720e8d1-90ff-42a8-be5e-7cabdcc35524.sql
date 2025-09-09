-- Add lead status as a system field in lead_field_definitions for all organizations
INSERT INTO public.lead_field_definitions (
  organization_id,
  field_key,
  label,
  field_type,
  is_system,
  is_required,
  is_visible_in_form,
  is_visible_in_table,
  sort_order,
  options
)
SELECT 
  o.id as organization_id,
  'status' as field_key,
  'Status' as label,
  'select' as field_type,
  true as is_system,
  false as is_required,
  true as is_visible_in_form,
  true as is_visible_in_table,
  0 as sort_order, -- Put it first
  jsonb_build_object(
    'options', 
    COALESCE(
      (
        SELECT jsonb_agg(ls.name ORDER BY ls.sort_order)
        FROM public.lead_statuses ls 
        WHERE ls.organization_id = o.id
      ),
      '[]'::jsonb
    )
  ) as options
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.lead_field_definitions lfd 
  WHERE lfd.organization_id = o.id 
  AND lfd.field_key = 'status'
);

-- Update sort_order for existing fields to make room for status field
UPDATE public.lead_field_definitions 
SET sort_order = sort_order + 1 
WHERE field_key != 'status';

-- Update the status field sort_order to 0
UPDATE public.lead_field_definitions 
SET sort_order = 0 
WHERE field_key = 'status';