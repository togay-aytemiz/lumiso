-- Permission checking functions
CREATE OR REPLACE FUNCTION public.user_has_permission(user_uuid uuid, permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    JOIN custom_roles cr ON om.custom_role_id = cr.id
    JOIN role_permissions rp ON cr.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE om.user_id = user_uuid 
    AND om.status = 'active'
    AND p.name = permission_name
  ) OR EXISTS (
    -- Check system roles (Owner has all permissions)
    SELECT 1 FROM organization_members om
    WHERE om.user_id = user_uuid 
    AND om.status = 'active'
    AND om.system_role = 'Owner'
  );
$$;

-- Assignee checking functions
CREATE OR REPLACE FUNCTION public.user_is_assigned_to_project(user_uuid uuid, project_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_uuid 
    AND (user_uuid = ANY(p.assignees) OR user_uuid = p.user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_assigned_to_lead(user_uuid uuid, lead_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = lead_uuid 
    AND (user_uuid = ANY(l.assignees) OR user_uuid = l.user_id)
  );
$$;

-- Combined organization + assignee check
CREATE OR REPLACE FUNCTION public.user_can_access_project(user_uuid uuid, project_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    JOIN organization_members om ON p.organization_id = om.organization_id
    WHERE p.id = project_uuid 
    AND om.user_id = user_uuid 
    AND om.status = 'active'
    AND (
      -- User has manage_all_projects permission
      public.user_has_permission(user_uuid, 'manage_all_projects') OR
      -- User is assigned to this project
      user_uuid = ANY(p.assignees) OR
      -- User created this project
      user_uuid = p.user_id
    )
  );
$$;