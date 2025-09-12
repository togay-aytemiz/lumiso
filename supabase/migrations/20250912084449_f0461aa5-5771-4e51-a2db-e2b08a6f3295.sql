-- Fix leads RLS policies step by step
-- First update the existing policies with better logic

-- Update leads view policies to use proper permission checks
CREATE OR REPLACE POLICY "Users with manage_all_leads can view all leads" 
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

-- Add policy for assigned leads viewing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'leads' 
    AND policyname = 'Users can view assigned leads with permission'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view assigned leads with permission" 
    ON public.leads FOR SELECT
    USING (
      organization_id = get_user_active_organization_id() AND
      user_has_permission(auth.uid(), ''view_assigned_leads'') AND (
        auth.uid() = ANY(assignees) OR auth.uid() = user_id
      )
    )';
  END IF;
END $$;

-- Update leads update policies
CREATE OR REPLACE POLICY "Users with manage_all_leads can update all leads" 
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

-- Add policy for assigned leads editing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'leads' 
    AND policyname = 'Users can update assigned leads with edit permission'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update assigned leads with edit permission" 
    ON public.leads FOR UPDATE
    USING (
      organization_id = get_user_active_organization_id() AND
      user_has_permission(auth.uid(), ''edit_assigned_leads'') AND (
        auth.uid() = ANY(assignees) OR auth.uid() = user_id
      )
    )';
  END IF;
END $$;