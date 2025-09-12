-- Fix RLS policies for proper team member access

-- First, let's update the user_has_permission function to be more robust
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
    SELECT 1 FROM organization_members om
    WHERE om.user_id = user_uuid 
    AND om.status = 'active'
    AND om.organization_id = get_user_active_organization_id()
    AND om.system_role = 'Owner'
  );
$function$;

-- Update leads RLS policies
DROP POLICY IF EXISTS "Users with manage_all_leads can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Users with manage_all_leads can update all leads" ON public.leads;
DROP POLICY IF EXISTS "Users can view assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update assigned leads they can edit" ON public.leads;
DROP POLICY IF EXISTS "Users with create_leads can create leads" ON public.leads;
DROP POLICY IF EXISTS "Users with delete_leads can delete leads" ON public.leads;

-- Create new, more robust leads policies
CREATE POLICY "Organization members with manage_all_leads can view all leads" 
ON public.leads FOR SELECT 
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'manage_all_leads') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = leads.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Organization members can view assigned leads" 
ON public.leads FOR SELECT
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'view_assigned_leads') AND (
      auth.uid() = ANY(assignees) OR auth.uid() = user_id
    )
  )
);

CREATE POLICY "Organization members with manage_all_leads can update all leads" 
ON public.leads FOR UPDATE
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'manage_all_leads') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = leads.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Organization members can update assigned leads they can edit" 
ON public.leads FOR UPDATE
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'edit_assigned_leads') AND (
      auth.uid() = ANY(assignees) OR auth.uid() = user_id
    )
  )
);

CREATE POLICY "Organization members with create_leads can create leads" 
ON public.leads FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'create_leads') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = leads.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Organization members with delete_leads can delete leads" 
ON public.leads FOR DELETE
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'delete_leads') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = leads.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

-- Add similar policies for projects table
DROP POLICY IF EXISTS "Organization members can create projects" ON public.projects;
DROP POLICY IF EXISTS "Organization members can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Organization members can update projects" ON public.projects;
DROP POLICY IF EXISTS "Organization members can view projects" ON public.projects;

CREATE POLICY "Organization members with manage_all_projects can view all projects" 
ON public.projects FOR SELECT
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'manage_all_projects') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = projects.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Organization members can view assigned projects" 
ON public.projects FOR SELECT
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'view_assigned_projects') AND (
      auth.uid() = ANY(assignees) OR auth.uid() = user_id
    )
  )
);

CREATE POLICY "Organization members with manage_all_projects can update all projects" 
ON public.projects FOR UPDATE
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'manage_all_projects') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = projects.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Organization members can update assigned projects they can edit" 
ON public.projects FOR UPDATE
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'edit_assigned_projects') AND (
      auth.uid() = ANY(assignees) OR auth.uid() = user_id
    )
  )
);

CREATE POLICY "Organization members with create_projects can create projects" 
ON public.projects FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'create_projects') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = projects.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Organization members with delete_projects can delete projects" 
ON public.projects FOR DELETE
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'delete_projects') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = projects.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);