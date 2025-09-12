-- Use correct PostgreSQL system catalogs to find problematic functions and views

-- Find functions in public schema that might not have SET search_path
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.prosecdef = true  -- Security definer functions
    AND pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%'
    AND p.proname NOT LIKE 'pg_%'
LIMIT 5;

-- Find views that might have SECURITY DEFINER (though this is unusual)
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE schemaname = 'public' 
    AND lower(definition) ILIKE '%security definer%'
LIMIT 5;

-- Now let's fix some specific functions that are likely causing issues
-- Fix all remaining functions to have proper search_path

-- Fix ensure_user_settings function
CREATE OR REPLACE FUNCTION public.ensure_user_settings(user_uuid uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  settings_id uuid;
BEGIN
  -- Try to get existing settings
  SELECT id INTO settings_id
  FROM public.user_settings
  WHERE user_id = user_uuid;
  
  -- Create default settings if they don't exist
  IF settings_id IS NULL THEN
    INSERT INTO public.user_settings (
      user_id, 
      show_quick_status_buttons,
      photography_business_name,
      logo_url,
      primary_brand_color,
      date_format,
      notification_global_enabled,
      notification_daily_summary_enabled,
      notification_new_assignment_enabled,
      notification_project_milestone_enabled,
      notification_scheduled_time
    ) VALUES (
      user_uuid,
      true,
      '',
      null,
      '#1EB29F',
      'DD/MM/YYYY',
      true,
      true,
      true,
      true,
      '12:30'
    ) RETURNING id INTO settings_id;
  END IF;
  
  RETURN settings_id;
END;
$$;

-- Fix ensure_organization_settings function
CREATE OR REPLACE FUNCTION public.ensure_organization_settings(org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  settings_id uuid;
BEGIN
  -- Try to get existing settings first
  SELECT id INTO settings_id
  FROM public.organization_settings
  WHERE organization_id = org_id;
  
  -- Only create if none exist
  IF settings_id IS NULL THEN
    INSERT INTO public.organization_settings (
      organization_id,
      date_format,
      time_format,
      photography_business_name,
      primary_brand_color
    ) VALUES (
      org_id,
      'DD/MM/YYYY',
      '12-hour',
      '',
      '#1EB29F'
    ) RETURNING id INTO settings_id;
  END IF;
  
  RETURN settings_id;
END;
$$;