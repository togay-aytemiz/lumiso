-- Fix leads RLS policies with proper syntax
-- Drop and recreate policies to avoid conflicts

-- Remove existing leads policies
DROP POLICY IF EXISTS "Users with manage_all_leads can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Users can view assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Users with manage_all_leads can update all leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update assigned leads they can edit" ON public.leads;

-- Create new leads view policies
CREATE POLICY "Users with manage_all_leads can view all leads" 
ON public.leads FOR SELECT 
USING (
  organization_id = get_user_active_organization_id() AND (
    user_has_permission(auth.uid(), 'manage_all_leads') OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = leads.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
      AND om.status = 'active'
    )
  )
);

CREATE POLICY "Users can view assigned leads with permission" 
ON public.leads FOR SELECT
USING (
  organization_id = get_user_active_organization_id() AND
  user_has_permission(auth.uid(), 'view_assigned_leads') AND (
    auth.uid() = ANY(assignees) OR auth.uid() = user_id
  )
);

-- Create new leads update policies
CREATE POLICY "Users with manage_all_leads can update all leads" 
ON public.leads FOR UPDATE
USING (
  organization_id = get_user_active_organization_id() AND (
    user_has_permission(auth.uid(), 'manage_all_leads') OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = leads.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
      AND om.status = 'active'
    )
  )
);

CREATE POLICY "Users can update assigned leads with edit permission" 
ON public.leads FOR UPDATE
USING (
  organization_id = get_user_active_organization_id() AND
  user_has_permission(auth.uid(), 'edit_assigned_leads') AND (
    auth.uid() = ANY(assignees) OR auth.uid() = user_id
  )
);