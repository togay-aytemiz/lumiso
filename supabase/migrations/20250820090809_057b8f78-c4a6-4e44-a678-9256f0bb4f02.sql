-- Fix RLS policies to ensure Owners have full access to all organization management tables

-- Fix project_statuses policies to include Owner bypass
DROP POLICY IF EXISTS "Organization members can create project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Organization members can update project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Organization members can delete project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Organization members can view project statuses" ON public.project_statuses;

CREATE POLICY "Organization owners and members can view project statuses" 
ON public.project_statuses FOR SELECT 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = project_statuses.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can create project statuses" 
ON public.project_statuses FOR INSERT 
WITH CHECK (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = project_statuses.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can update project statuses" 
ON public.project_statuses FOR UPDATE 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = project_statuses.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can delete project statuses" 
ON public.project_statuses FOR DELETE 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = project_statuses.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

-- Fix session_statuses policies to include Owner bypass
DROP POLICY IF EXISTS "Organization members can create session statuses" ON public.session_statuses;
DROP POLICY IF EXISTS "Organization members can update session statuses" ON public.session_statuses;
DROP POLICY IF EXISTS "Organization members can delete non-system session statuses" ON public.session_statuses;
DROP POLICY IF EXISTS "Organization members can view session statuses" ON public.session_statuses;

CREATE POLICY "Organization owners and members can view session statuses" 
ON public.session_statuses FOR SELECT 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = session_statuses.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can create session statuses" 
ON public.session_statuses FOR INSERT 
WITH CHECK (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = session_statuses.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can update session statuses" 
ON public.session_statuses FOR UPDATE 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = session_statuses.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can delete non-system session statuses" 
ON public.session_statuses FOR DELETE 
USING (
  (organization_id = get_user_active_organization_id() OR
   EXISTS (
     SELECT 1 FROM organization_members om 
     WHERE om.organization_id = session_statuses.organization_id 
     AND om.user_id = auth.uid() 
     AND om.system_role = 'Owner'
   )) AND is_system_initial = false
);

-- Fix lead_statuses policies to include Owner bypass
DROP POLICY IF EXISTS "Organization members can create lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Organization members can update lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Organization members can delete lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Organization members can view lead statuses" ON public.lead_statuses;

CREATE POLICY "Organization owners and members can view lead statuses" 
ON public.lead_statuses FOR SELECT 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = lead_statuses.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can create lead statuses" 
ON public.lead_statuses FOR INSERT 
WITH CHECK (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = lead_statuses.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can update lead statuses" 
ON public.lead_statuses FOR UPDATE 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = lead_statuses.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can delete lead statuses" 
ON public.lead_statuses FOR DELETE 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = lead_statuses.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

-- Fix project_types policies to include Owner bypass
DROP POLICY IF EXISTS "Organization members can create project types" ON public.project_types;
DROP POLICY IF EXISTS "Organization members can update project types" ON public.project_types;
DROP POLICY IF EXISTS "Organization members can delete project types" ON public.project_types;
DROP POLICY IF EXISTS "Organization members can view project types" ON public.project_types;

CREATE POLICY "Organization owners and members can view project types" 
ON public.project_types FOR SELECT 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = project_types.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can create project types" 
ON public.project_types FOR INSERT 
WITH CHECK (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = project_types.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can update project types" 
ON public.project_types FOR UPDATE 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = project_types.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can delete project types" 
ON public.project_types FOR DELETE 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = project_types.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

-- Fix services policies to include Owner bypass
DROP POLICY IF EXISTS "Organization members can create services" ON public.services;
DROP POLICY IF EXISTS "Organization members can update services" ON public.services;
DROP POLICY IF EXISTS "Organization members can delete services" ON public.services;
DROP POLICY IF EXISTS "Organization members can view services" ON public.services;

CREATE POLICY "Organization owners and members can view services" 
ON public.services FOR SELECT 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = services.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can create services" 
ON public.services FOR INSERT 
WITH CHECK (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = services.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can update services" 
ON public.services FOR UPDATE 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = services.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can delete services" 
ON public.services FOR DELETE 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = services.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

-- Fix packages policies to include Owner bypass
DROP POLICY IF EXISTS "Organization members can create packages" ON public.packages;
DROP POLICY IF EXISTS "Organization members can update packages" ON public.packages;
DROP POLICY IF EXISTS "Organization members can delete packages" ON public.packages;
DROP POLICY IF EXISTS "Organization members can view packages" ON public.packages;

CREATE POLICY "Organization owners and members can view packages" 
ON public.packages FOR SELECT 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = packages.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can create packages" 
ON public.packages FOR INSERT 
WITH CHECK (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = packages.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can update packages" 
ON public.packages FOR UPDATE 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = packages.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);

CREATE POLICY "Organization owners and members can delete packages" 
ON public.packages FOR DELETE 
USING (
  organization_id = get_user_active_organization_id() OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = packages.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
);