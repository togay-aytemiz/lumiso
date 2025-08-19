-- Step 3: Optimize remaining table RLS policies

-- Update project_statuses RLS policies
DROP POLICY IF EXISTS "Organization members can view project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Organization members can create project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Organization members can update project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Organization members can delete project statuses" ON public.project_statuses;

CREATE POLICY "Organization members can view project statuses"
ON public.project_statuses FOR SELECT
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can create project statuses"
ON public.project_statuses FOR INSERT
WITH CHECK (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can update project statuses"
ON public.project_statuses FOR UPDATE
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can delete project statuses"
ON public.project_statuses FOR DELETE
USING (organization_id = get_user_active_organization_id());

-- Update session_statuses RLS policies
DROP POLICY IF EXISTS "Organization members can view session statuses" ON public.session_statuses;
DROP POLICY IF EXISTS "Organization members can create session statuses" ON public.session_statuses;
DROP POLICY IF EXISTS "Organization members can update session statuses" ON public.session_statuses;
DROP POLICY IF EXISTS "Organization members can delete non-system session statuses" ON public.session_statuses;

CREATE POLICY "Organization members can view session statuses"
ON public.session_statuses FOR SELECT
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can create session statuses"
ON public.session_statuses FOR INSERT
WITH CHECK (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can update session statuses"
ON public.session_statuses FOR UPDATE
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can delete non-system session statuses"
ON public.session_statuses FOR DELETE
USING (organization_id = get_user_active_organization_id() AND is_system_initial = false);

-- Update activities RLS policies
DROP POLICY IF EXISTS "Organization members can view activities" ON public.activities;
DROP POLICY IF EXISTS "Organization members can create activities" ON public.activities;
DROP POLICY IF EXISTS "Organization members can update activities" ON public.activities;
DROP POLICY IF EXISTS "Organization members can delete activities" ON public.activities;

CREATE POLICY "Organization members can view activities"
ON public.activities FOR SELECT
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can create activities"
ON public.activities FOR INSERT
WITH CHECK (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can update activities"
ON public.activities FOR UPDATE
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can delete activities"
ON public.activities FOR DELETE
USING (organization_id = get_user_active_organization_id());

-- Update services RLS policies
DROP POLICY IF EXISTS "Organization members can view services" ON public.services;
DROP POLICY IF EXISTS "Organization members can create services" ON public.services;
DROP POLICY IF EXISTS "Organization members can update services" ON public.services;
DROP POLICY IF EXISTS "Organization members can delete services" ON public.services;

CREATE POLICY "Organization members can view services"
ON public.services FOR SELECT
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can create services"
ON public.services FOR INSERT
WITH CHECK (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can update services"
ON public.services FOR UPDATE
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can delete services"
ON public.services FOR DELETE
USING (organization_id = get_user_active_organization_id());

-- Update packages RLS policies
DROP POLICY IF EXISTS "Organization members can view packages" ON public.packages;
DROP POLICY IF EXISTS "Organization members can create packages" ON public.packages;
DROP POLICY IF EXISTS "Organization members can update packages" ON public.packages;
DROP POLICY IF EXISTS "Organization members can delete packages" ON public.packages;

CREATE POLICY "Organization members can view packages"
ON public.packages FOR SELECT
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can create packages"
ON public.packages FOR INSERT
WITH CHECK (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can update packages"
ON public.packages FOR UPDATE
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can delete packages"
ON public.packages FOR DELETE
USING (organization_id = get_user_active_organization_id());

-- Add indexes for remaining tables
CREATE INDEX IF NOT EXISTS idx_project_statuses_org_sort 
ON public.project_statuses(organization_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_session_statuses_org_sort 
ON public.session_statuses(organization_id, sort_order, is_system_initial);

CREATE INDEX IF NOT EXISTS idx_activities_org_created 
ON public.activities(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_services_org_category 
ON public.services(organization_id, category, is_sample);

CREATE INDEX IF NOT EXISTS idx_packages_org_active 
ON public.packages(organization_id, is_active);