-- Fix search_path for the migration functions
CREATE OR REPLACE FUNCTION public.migrate_existing_lead_data(org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Migrate existing lead data to field values table
  INSERT INTO public.lead_field_values (lead_id, field_key, value)
  SELECT 
    l.id,
    'name',
    l.name
  FROM public.leads l
  WHERE l.organization_id = org_id
    AND l.name IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_field_values lfv 
      WHERE lfv.lead_id = l.id AND lfv.field_key = 'name'
    );

  INSERT INTO public.lead_field_values (lead_id, field_key, value)
  SELECT 
    l.id,
    'email',
    l.email
  FROM public.leads l
  WHERE l.organization_id = org_id
    AND l.email IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_field_values lfv 
      WHERE lfv.lead_id = l.id AND lfv.field_key = 'email'
    );

  INSERT INTO public.lead_field_values (lead_id, field_key, value)
  SELECT 
    l.id,
    'phone',
    l.phone
  FROM public.leads l
  WHERE l.organization_id = org_id
    AND l.phone IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_field_values lfv 
      WHERE lfv.lead_id = l.id AND lfv.field_key = 'phone'
    );

  INSERT INTO public.lead_field_values (lead_id, field_key, value)
  SELECT 
    l.id,
    'notes',
    l.notes
  FROM public.leads l
  WHERE l.organization_id = org_id
    AND l.notes IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_field_values lfv 
      WHERE lfv.lead_id = l.id AND lfv.field_key = 'notes'
    );
END;
$$;

-- Fix search_path for initialization function
CREATE OR REPLACE FUNCTION public.initialize_all_organization_field_definitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN 
    SELECT id, owner_id FROM public.organizations
  LOOP
    PERFORM public.ensure_default_lead_field_definitions(org_record.id, org_record.owner_id);
    PERFORM public.migrate_existing_lead_data(org_record.id);
  END LOOP;
END;
$$;