-- Ensure Notes field is visible in lead forms by default for new organizations
CREATE OR REPLACE FUNCTION public.ensure_default_lead_field_definitions(org_id UUID, user_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  field_count INTEGER;
BEGIN
  -- Check if organization already has field definitions
  SELECT COUNT(*) INTO field_count 
  FROM public.lead_field_definitions 
  WHERE organization_id = org_id;
  
  -- Only create defaults if no field definitions exist
  IF field_count = 0 THEN
    INSERT INTO public.lead_field_definitions (
      organization_id, field_key, label, field_type, is_system, is_required, is_visible_in_form, sort_order
    ) VALUES
      (org_id, 'name', 'Full Name', 'text', true, true, true, 1),
      (org_id, 'email', 'Email Address', 'email', true, false, true, 2),
      (org_id, 'phone', 'Phone Number', 'phone', true, false, true, 3),
      (org_id, 'notes', 'Notes', 'textarea', true, false, true, 4);
  END IF;
END;
$$;
