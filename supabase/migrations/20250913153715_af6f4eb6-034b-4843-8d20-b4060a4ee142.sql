-- Update the get_user_active_organization_id function to return the owner's organization
CREATE OR REPLACE FUNCTION public.get_user_active_organization_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Return the organization owned by the current user (single-user mode)
  SELECT id FROM public.organizations WHERE owner_id = auth.uid() LIMIT 1;
$function$;

-- Ensure default lead field definitions for organizations that don't have them
CREATE OR REPLACE FUNCTION public.ensure_lead_status_field(org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  status_field_exists BOOLEAN;
BEGIN
  -- Check if status field exists for this organization
  SELECT EXISTS (
    SELECT 1 FROM public.lead_field_definitions 
    WHERE organization_id = org_id AND field_key = 'status'
  ) INTO status_field_exists;
  
  -- If status field doesn't exist, create it
  IF NOT status_field_exists THEN
    INSERT INTO public.lead_field_definitions (
      organization_id, field_key, label, field_type, is_system, is_required, is_visible_in_form, is_visible_in_table, sort_order
    ) VALUES (
      org_id, 'status', 'Status', 'select', true, true, true, true, 10
    );
  END IF;
END;
$function$;