-- Fix database functions by dropping and recreating them with proper types
-- Fix ambiguous column reference issues in permission functions

-- Drop existing functions to avoid type conflicts
DROP FUNCTION IF EXISTS public.get_user_permissions(uuid);

-- Replace user_has_permission function with explicit table aliases to avoid column ambiguity
CREATE OR REPLACE FUNCTION public.user_has_permission(user_uuid uuid, permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Check if user has permission through custom role
  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    JOIN custom_roles cr ON om.custom_role_id = cr.id
    JOIN role_permissions rp ON cr.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE om.user_id = user_uuid 
    AND om.status = 'active'
    AND om.organization_id = get_user_active_organization_id()
    AND p.name = permission_name
  ) OR EXISTS (
    -- Check system roles (Owner has all permissions)
    SELECT 1 FROM organization_members om2
    WHERE om2.user_id = user_uuid 
    AND om2.status = 'active'
    AND om2.organization_id = get_user_active_organization_id()
    AND om2.system_role = 'Owner'
  );
$function$;

-- Create safe_user_has_permission function that doesn't throw errors
CREATE OR REPLACE FUNCTION public.safe_user_has_permission(user_uuid uuid, permission_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Return false if user_uuid is null
  IF user_uuid IS NULL THEN
    RETURN false;
  END IF;
  
  -- Use the main function but catch any errors
  BEGIN
    RETURN public.user_has_permission(user_uuid, permission_name);
  EXCEPTION WHEN OTHERS THEN
    -- Log error and return false for safety
    RAISE WARNING 'Error in safe_user_has_permission for user % and permission %: %', user_uuid, permission_name, SQLERRM;
    RETURN false;
  END;
END;
$function$;

-- Recreate get_user_permissions function with corrected return type (text array)
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_uuid uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  org_id uuid;
  user_role text;
  permissions_array text[];
BEGIN
  -- Get user's active organization
  SELECT get_user_active_organization_id() INTO org_id;
  
  IF org_id IS NULL OR user_uuid IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;
  
  -- Check if user is Owner (has all permissions)
  SELECT om.system_role INTO user_role
  FROM organization_members om
  WHERE om.user_id = user_uuid 
  AND om.organization_id = org_id
  AND om.status = 'active';
  
  IF user_role = 'Owner' THEN
    -- Get all permissions
    SELECT ARRAY_AGG(p.name) INTO permissions_array
    FROM permissions p;
    
    RETURN COALESCE(permissions_array, ARRAY[]::text[]);
  ELSE
    -- Get permissions from custom role
    SELECT ARRAY_AGG(p.name) INTO permissions_array
    FROM organization_members om
    JOIN custom_roles cr ON om.custom_role_id = cr.id
    JOIN role_permissions rp ON cr.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE om.user_id = user_uuid 
    AND om.status = 'active'
    AND om.organization_id = org_id;
    
    RETURN COALESCE(permissions_array, ARRAY[]::text[]);
  END IF;
END;
$function$;