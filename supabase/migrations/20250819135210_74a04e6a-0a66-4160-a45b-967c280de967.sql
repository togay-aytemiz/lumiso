-- Update RLS policies for projects to respect permissions and assignments  
DROP POLICY IF EXISTS "Organization members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Organization members can update projects" ON public.projects;
DROP POLICY IF EXISTS "Organization members can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Organization members can create projects" ON public.projects;

-- New granular policies for projects
CREATE POLICY "Users with manage_all_projects can view all projects" 
ON public.projects 
FOR SELECT 
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
  ) 
  AND (
    public.user_has_permission(auth.uid(), 'manage_all_projects') OR
    EXISTS (
      SELECT 1 FROM organization_members om2 
      WHERE om2.organization_id = projects.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users can view assigned projects" 
ON public.projects 
FOR SELECT 
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
  ) 
  AND (
    public.user_has_permission(auth.uid(), 'view_assigned_projects') AND
    (auth.uid() = ANY(assignees) OR auth.uid() = user_id)
  )
);

CREATE POLICY "Users with create_projects can create projects" 
ON public.projects 
FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
  ) 
  AND (
    public.user_has_permission(auth.uid(), 'create_projects') OR
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = projects.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users with manage_all_projects can update all projects" 
ON public.projects 
FOR UPDATE 
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
  ) 
  AND (
    public.user_has_permission(auth.uid(), 'manage_all_projects') OR
    EXISTS (
      SELECT 1 FROM organization_members om2 
      WHERE om2.organization_id = projects.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users can update assigned projects they can edit" 
ON public.projects 
FOR UPDATE 
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
  ) 
  AND public.user_has_permission(auth.uid(), 'edit_assigned_projects')
  AND (auth.uid() = ANY(assignees) OR auth.uid() = user_id)
);

CREATE POLICY "Users with delete_projects can delete projects" 
ON public.projects 
FOR DELETE 
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
  ) 
  AND (
    public.user_has_permission(auth.uid(), 'delete_projects') OR
    EXISTS (
      SELECT 1 FROM organization_members om2 
      WHERE om2.organization_id = projects.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

-- Create default member role with basic permissions for existing organizations
-- This ensures current members get appropriate permissions
DO $$
DECLARE
    org_record RECORD;
    default_role_id UUID;
BEGIN
    FOR org_record IN SELECT id FROM organizations LOOP
        -- Check if organization already has a default member role
        SELECT id INTO default_role_id 
        FROM custom_roles 
        WHERE organization_id = org_record.id 
        AND name = 'Member' 
        LIMIT 1;
        
        -- If no default role exists, create one
        IF default_role_id IS NULL THEN
            INSERT INTO custom_roles (organization_id, name, description, sort_order)
            VALUES (org_record.id, 'Member', 'Default member role with basic permissions', 1)
            RETURNING id INTO default_role_id;
            
            -- Add basic permissions for members
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT default_role_id, p.id
            FROM permissions p
            WHERE p.name IN (
                'view_assigned_leads',
                'edit_assigned_leads', 
                'view_assigned_projects',
                'edit_assigned_projects',
                'view_assigned_sessions',
                'edit_assigned_sessions',
                'create_leads',
                'create_projects',
                'create_sessions',
                'view_services',
                'view_payments'
            );
        END IF;
        
        -- Update existing members without custom roles to use this default role
        UPDATE organization_members 
        SET custom_role_id = default_role_id
        WHERE organization_id = org_record.id 
        AND system_role = 'Member' 
        AND custom_role_id IS NULL;
    END LOOP;
END $$;