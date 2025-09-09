-- Update ensure_default_lead_statuses_for_org to also sync the status field
CREATE OR REPLACE FUNCTION public.ensure_default_lead_statuses_for_org(user_uuid uuid, org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  status_count INTEGER;
BEGIN
  -- Check if organization already has lead statuses (idempotent check)
  SELECT COUNT(*) INTO status_count 
  FROM public.lead_statuses 
  WHERE organization_id = org_id;
  
  -- Only create defaults if no statuses exist for this organization
  IF status_count = 0 THEN
    -- Create clean default lead statuses (without "Not Interested")
    INSERT INTO public.lead_statuses (user_id, organization_id, name, color, is_system_final, sort_order, is_default, lifecycle, is_system_required) VALUES
      (user_uuid, org_id, 'New', '#A0AEC0', false, 1, true, 'active', true),
      (user_uuid, org_id, 'Contacted', '#4299E1', false, 2, false, 'active', false),
      (user_uuid, org_id, 'Qualified', '#48BB78', false, 3, false, 'active', false),
      (user_uuid, org_id, 'Booked', '#9F7AEA', false, 4, false, 'active', false),
      (user_uuid, org_id, 'Completed', '#22c55e', true, 1000, false, 'completed', false),
      (user_uuid, org_id, 'Lost', '#ef4444', true, 1001, false, 'cancelled', false);
  END IF;
  
  -- Always ensure the status field is synced
  PERFORM public.ensure_lead_status_field(org_id);
END;
$function$;