-- Fix projects RLS policies
-- Drop existing project policies that need updating
DROP POLICY IF EXISTS "Organization members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Organization members can update projects" ON public.projects;

-- Create new project view policies with proper permission checks
CREATE POLICY "Users with manage_all_projects can view all projects" 
ON public.projects FOR SELECT
USING (
  organization_id = get_user_active_organization_id() AND (
    user_has_permission(auth.uid(), 'manage_all_projects') OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = projects.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
      AND om.status = 'active'
    )
  )
);

CREATE POLICY "Users can view assigned projects with permission" 
ON public.projects FOR SELECT
USING (
  organization_id = get_user_active_organization_id() AND
  user_has_permission(auth.uid(), 'view_assigned_projects') AND (
    auth.uid() = ANY(assignees) OR auth.uid() = user_id
  )
);

-- Create new project update policies
CREATE POLICY "Users with manage_all_projects can update all projects" 
ON public.projects FOR UPDATE
USING (
  organization_id = get_user_active_organization_id() AND (
    user_has_permission(auth.uid(), 'manage_all_projects') OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = projects.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
      AND om.status = 'active'
    )
  )
);

CREATE POLICY "Users can update assigned projects with edit permission" 
ON public.projects FOR UPDATE
USING (
  organization_id = get_user_active_organization_id() AND
  user_has_permission(auth.uid(), 'edit_assigned_projects') AND (
    auth.uid() = ANY(assignees) OR auth.uid() = user_id
  )
);