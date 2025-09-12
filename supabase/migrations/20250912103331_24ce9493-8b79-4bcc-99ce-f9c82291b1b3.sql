-- Find all functions without proper search_path set
SELECT 
    schemaname,
    functionname,
    definition
FROM pg_functions 
WHERE schemaname = 'public' 
    AND definition NOT LIKE '%SET search_path%'
    AND functionname NOT LIKE 'pg_%'
    AND functionname NOT LIKE 'uuid_%'
    AND functionname NOT LIKE 'gen_%'
    AND functionname NOT LIKE 'array_%'
    AND functionname NOT LIKE 'jsonb_%'
LIMIT 10;

-- Find all views with SECURITY DEFINER (these cause the ERROR warnings)
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE schemaname = 'public' 
    AND definition ILIKE '%security definer%'
LIMIT 10;

-- Fix any remaining functions that don't have SET search_path
-- Let's check a few specific functions that might be causing issues

-- Fix ensure_default_session_statuses function
CREATE OR REPLACE FUNCTION public.ensure_default_session_statuses(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cnt INTEGER;
  org_id UUID;
BEGIN
  -- Get user's active organization
  SELECT get_user_active_organization_id() INTO org_id;
  IF org_id IS NULL THEN
    RETURN; -- No organization found
  END IF;

  -- Check if organization already has session statuses
  SELECT COUNT(*) INTO cnt FROM public.session_statuses WHERE organization_id = org_id;
  
  IF cnt = 0 THEN
    INSERT INTO public.session_statuses (user_id, organization_id, name, color, sort_order, is_system_initial, lifecycle, is_system_required) VALUES
      (user_uuid, org_id, 'Planned',   '#A0AEC0', 1, true, 'active', true),
      (user_uuid, org_id, 'Confirmed', '#ECC94B', 2, false, 'active', false),
      (user_uuid, org_id, 'Editing',   '#9F7AEA', 3, false, 'active', false),
      (user_uuid, org_id, 'Delivered', '#4299E1', 4, false, 'completed', false),
      (user_uuid, org_id, 'Completed', '#48BB78', 5, false, 'completed', false),
      (user_uuid, org_id, 'Cancelled', '#F56565', 6, false, 'cancelled', false);
  END IF;
END;
$$;

-- Fix ensure_system_lead_statuses function  
CREATE OR REPLACE FUNCTION public.ensure_system_lead_statuses(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  system_status_count INTEGER;
  completed_status_id UUID;
  lost_status_id UUID;
  org_id UUID;
BEGIN
  -- Get user's active organization
  SELECT get_user_active_organization_id() INTO org_id;
  IF org_id IS NULL THEN
    RETURN; -- No organization found
  END IF;

  -- Count existing system statuses for this organization
  SELECT COUNT(*) INTO system_status_count 
  FROM public.lead_statuses 
  WHERE organization_id = org_id AND is_system_final = true;
  
  -- If we already have 2 system statuses, don't create more
  IF system_status_count >= 2 THEN
    RETURN;
  END IF;
  
  -- Check for existing completed-type status
  SELECT id INTO completed_status_id 
  FROM public.lead_statuses 
  WHERE organization_id = org_id AND is_system_final = true 
  AND color = '#22c55e'  -- Green color for completed
  LIMIT 1;
  
  -- Check for existing lost-type status  
  SELECT id INTO lost_status_id 
  FROM public.lead_statuses 
  WHERE organization_id = org_id AND is_system_final = true 
  AND color = '#ef4444'  -- Red color for lost
  LIMIT 1;
  
  -- Only create if they don't exist (with proper lifecycle values)
  IF completed_status_id IS NULL THEN
    INSERT INTO public.lead_statuses (user_id, organization_id, name, color, is_system_final, sort_order, lifecycle)
    VALUES (user_uuid, org_id, 'Completed', '#22c55e', true, 1000, 'completed');
  END IF;
  
  IF lost_status_id IS NULL THEN
    INSERT INTO public.lead_statuses (user_id, organization_id, name, color, is_system_final, sort_order, lifecycle)
    VALUES (user_uuid, org_id, 'Lost', '#ef4444', true, 1001, 'cancelled');
  END IF;
END;
$$;