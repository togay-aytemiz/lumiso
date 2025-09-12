-- Create the user_has_permission function that's referenced in RLS policies
CREATE OR REPLACE FUNCTION public.user_has_permission(user_uuid uuid, permission_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  org_id uuid;
  user_role text;
  custom_role_id uuid;
  has_perm boolean := false;
BEGIN
  -- Get the user's active organization
  SELECT active_organization_id INTO org_id
  FROM user_settings 
  WHERE user_id = user_uuid;
  
  -- If no active org, check first organization membership
  IF org_id IS NULL THEN
    SELECT organization_id INTO org_id
    FROM organization_members 
    WHERE user_id = user_uuid AND status = 'active'
    ORDER BY joined_at ASC
    LIMIT 1;
  END IF;
  
  -- If still no organization, return false
  IF org_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get user's membership info in the organization
  SELECT system_role, custom_role_id INTO user_role, custom_role_id
  FROM organization_members 
  WHERE user_id = user_uuid 
    AND organization_id = org_id 
    AND status = 'active';
  
  -- If not a member, return false
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Owners have all permissions
  IF user_role = 'Owner' THEN
    RETURN true;
  END IF;
  
  -- Check custom role permissions
  IF custom_role_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = custom_role_id 
        AND p.name = permission_name
    ) INTO has_perm;
  END IF;
  
  RETURN has_perm;
END;
$$;

-- Add comprehensive error handling function
CREATE OR REPLACE FUNCTION public.safe_user_has_permission(user_uuid uuid, permission_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  BEGIN
    RETURN public.user_has_permission(user_uuid, permission_name);
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail - return false for safety
    RAISE WARNING 'Permission check failed for user % permission %: %', user_uuid, permission_name, SQLERRM;
    RETURN false;
  END;
END;
$$;

-- Create helper function to get user's organization permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_uuid uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  org_id uuid;
  user_role text;
  custom_role_id uuid;
  permissions_array text[] := '{}';
BEGIN
  -- Get the user's active organization
  SELECT active_organization_id INTO org_id
  FROM user_settings 
  WHERE user_id = user_uuid;
  
  -- If no active org, check first organization membership
  IF org_id IS NULL THEN
    SELECT organization_id INTO org_id
    FROM organization_members 
    WHERE user_id = user_uuid AND status = 'active'
    ORDER BY joined_at ASC
    LIMIT 1;
  END IF;
  
  -- If still no organization, return empty array
  IF org_id IS NULL THEN
    RETURN permissions_array;
  END IF;
  
  -- Get user's membership info in the organization
  SELECT system_role, custom_role_id INTO user_role, custom_role_id
  FROM organization_members 
  WHERE user_id = user_uuid 
    AND organization_id = org_id 
    AND status = 'active';
  
  -- If not a member, return empty array
  IF user_role IS NULL THEN
    RETURN permissions_array;
  END IF;
  
  -- Owners have all permissions
  IF user_role = 'Owner' THEN
    SELECT array_agg(name) INTO permissions_array
    FROM permissions;
    RETURN COALESCE(permissions_array, '{}');
  END IF;
  
  -- Get custom role permissions
  IF custom_role_id IS NOT NULL THEN
    SELECT array_agg(p.name) INTO permissions_array
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.role_id = custom_role_id;
  END IF;
  
  RETURN COALESCE(permissions_array, '{}');
END;
$$;