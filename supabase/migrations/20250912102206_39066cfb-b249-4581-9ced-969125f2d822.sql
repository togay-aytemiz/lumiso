-- Fix ambiguous column reference issues in permission functions
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

-- Create get_user_permissions function with explicit aliases
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_uuid uuid)
RETURNS TABLE(permission_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Get permissions from custom role
  SELECT p.name as permission_name
  FROM organization_members om
  JOIN custom_roles cr ON om.custom_role_id = cr.id
  JOIN role_permissions rp ON cr.id = rp.role_id
  JOIN permissions p ON rp.permission_id = p.id
  WHERE om.user_id = user_uuid 
  AND om.status = 'active'
  AND om.organization_id = get_user_active_organization_id()
  
  UNION
  
  -- If user is Owner, get all permissions
  SELECT p2.name as permission_name
  FROM permissions p2
  WHERE EXISTS (
    SELECT 1 FROM organization_members om2
    WHERE om2.user_id = user_uuid 
    AND om2.status = 'active'
    AND om2.organization_id = get_user_active_organization_id()
    AND om2.system_role = 'Owner'
  );
$function$;