-- Step 1: Optimize organization context and RLS policies

-- First, create a more efficient single organization function
CREATE OR REPLACE FUNCTION public.get_user_active_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Get the active organization from user settings first (most common case)
  SELECT COALESCE(
    (SELECT us.active_organization_id 
     FROM public.user_settings us 
     WHERE us.user_id = auth.uid() 
     AND us.active_organization_id IS NOT NULL),
    -- Fallback to first active membership if no active org set
    (SELECT om.organization_id 
     FROM public.organization_members om 
     WHERE om.user_id = auth.uid() 
     AND om.status = 'active'
     ORDER BY om.joined_at ASC 
     LIMIT 1)
  );
$$;

-- Add strategic indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_settings_user_active_org 
ON public.user_settings(user_id, active_organization_id) 
WHERE active_organization_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_members_user_status 
ON public.organization_members(user_id, status, joined_at) 
WHERE status = 'active';

-- Optimize project_types RLS policies
DROP POLICY IF EXISTS "Organization members can view project types" ON public.project_types;
DROP POLICY IF EXISTS "Organization members can create project types" ON public.project_types;
DROP POLICY IF EXISTS "Organization members can update project types" ON public.project_types;
DROP POLICY IF EXISTS "Organization members can delete project types" ON public.project_types;

CREATE POLICY "Organization members can view project types"
ON public.project_types FOR SELECT
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can create project types"
ON public.project_types FOR INSERT
WITH CHECK (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can update project types"
ON public.project_types FOR UPDATE
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can delete project types"
ON public.project_types FOR DELETE
USING (organization_id = get_user_active_organization_id());

-- Optimize lead_statuses RLS policies
DROP POLICY IF EXISTS "Organization members can view lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Organization members can create lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Organization members can update lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Organization members can delete lead statuses" ON public.lead_statuses;

CREATE POLICY "Organization members can view lead statuses"
ON public.lead_statuses FOR SELECT
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can create lead statuses"
ON public.lead_statuses FOR INSERT
WITH CHECK (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can update lead statuses"
ON public.lead_statuses FOR UPDATE
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can delete lead statuses"
ON public.lead_statuses FOR DELETE
USING (organization_id = get_user_active_organization_id());

-- Add composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_types_org_sort 
ON public.project_types(organization_id, sort_order, is_default);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_statuses_org_sort 
ON public.lead_statuses(organization_id, sort_order, is_system_final);