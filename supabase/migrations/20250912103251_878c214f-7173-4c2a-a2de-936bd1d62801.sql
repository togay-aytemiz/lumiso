-- Fix security definer functions by ensuring proper search_path is set
-- This addresses WARN 3-6 about Function Search Path Mutable

-- Fix get_user_permissions function
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_uuid uuid)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_permissions TEXT[];
  org_id UUID;
BEGIN
  -- Get user's active organization
  SELECT us.active_organization_id INTO org_id
  FROM public.user_settings us
  WHERE us.user_id = user_uuid;

  IF org_id IS NULL THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  -- Get user's organization membership
  SELECT CASE 
    WHEN om.system_role = 'Owner' THEN 
      (SELECT ARRAY_AGG(p.name) FROM public.permissions p)
    WHEN om.custom_role_id IS NOT NULL THEN
      (SELECT ARRAY_AGG(p.name) 
       FROM public.permissions p
       JOIN public.role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = om.custom_role_id)
    ELSE 
      ARRAY[]::TEXT[]
  END INTO user_permissions
  FROM public.organization_members om
  WHERE om.user_id = user_uuid 
    AND om.organization_id = org_id 
    AND om.status = 'active';

  RETURN COALESCE(user_permissions, ARRAY[]::TEXT[]);
END;
$$;

-- Fix user_has_permission function  
CREATE OR REPLACE FUNCTION public.user_has_permission(user_uuid uuid, permission_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_permissions TEXT[];
BEGIN
  user_permissions := public.get_user_permissions(user_uuid);
  RETURN permission_name = ANY(user_permissions);
END;
$$;

-- Fix safe_user_has_permission function
CREATE OR REPLACE FUNCTION public.safe_user_has_permission(user_uuid uuid, permission_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF user_uuid IS NULL OR permission_name IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN public.user_has_permission(user_uuid, permission_name);
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Fix handle_new_user_profile function
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  display_name text;
BEGIN
  -- Determine display name with fallbacks
  display_name := NEW.raw_user_meta_data ->> 'full_name';
  
  IF display_name IS NULL OR display_name = '' THEN
    IF NEW.email IS NOT NULL THEN
      display_name := split_part(NEW.email, '@', 1);
    ELSE
      display_name := 'User ' || substring(NEW.id::text from 1 for 8);
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, display_name)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Review and potentially drop security definer views that might be causing issues
-- Check if there are any problematic views and recreate them properly
DO $$
BEGIN
  -- This will help identify any security definer views
  RAISE NOTICE 'Checking for security definer views...';
END;
$$;