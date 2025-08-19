-- Update RLS policies for leads to respect permissions and assignments
DROP POLICY IF EXISTS "Organization members can view leads" ON public.leads;
DROP POLICY IF EXISTS "Organization members can update leads" ON public.leads;
DROP POLICY IF EXISTS "Organization members can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Organization members can create leads" ON public.leads;

-- New granular policies for leads
CREATE POLICY "Users with manage_all_leads can view all leads" 
ON public.leads 
FOR SELECT 
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
  ) 
  AND (
    public.user_has_permission(auth.uid(), 'manage_all_leads') OR
    om.system_role = 'Owner'
  )
);

CREATE POLICY "Users can view assigned leads" 
ON public.leads 
FOR SELECT 
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
  ) 
  AND (
    public.user_has_permission(auth.uid(), 'view_assigned_leads') AND
    (auth.uid() = ANY(assignees) OR auth.uid() = user_id)
  )
);

CREATE POLICY "Users with create_leads can create leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
  ) 
  AND (
    public.user_has_permission(auth.uid(), 'create_leads') OR
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = leads.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users with manage_all_leads can update all leads" 
ON public.leads 
FOR UPDATE 
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
  ) 
  AND (
    public.user_has_permission(auth.uid(), 'manage_all_leads') OR
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = leads.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users can update assigned leads they can edit" 
ON public.leads 
FOR UPDATE 
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
  ) 
  AND public.user_has_permission(auth.uid(), 'edit_assigned_leads')
  AND (auth.uid() = ANY(assignees) OR auth.uid() = user_id)
);

CREATE POLICY "Users with delete_leads can delete leads" 
ON public.leads 
FOR DELETE 
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
  ) 
  AND (
    public.user_has_permission(auth.uid(), 'delete_leads') OR
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = leads.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
    )
  )
);

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
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = projects.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
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
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = projects.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
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
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = projects.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
    )
  )
);