-- Fix RLS policies to be organization-based instead of user-based

-- Update lead_statuses policies to be organization-based
DROP POLICY IF EXISTS "Users can create their own lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Users can view their own lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Users can update their own lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Users can delete their own lead statuses" ON public.lead_statuses;

-- Add organization_id column to lead_statuses if it doesn't exist
ALTER TABLE public.lead_statuses ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Update existing lead_statuses with organization_id from user's active organization
UPDATE public.lead_statuses 
SET organization_id = (
  SELECT us.active_organization_id 
  FROM public.user_settings us 
  WHERE us.user_id = lead_statuses.user_id
)
WHERE organization_id IS NULL;

CREATE POLICY "Organization members can create lead statuses" 
ON public.lead_statuses 
FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can view lead statuses" 
ON public.lead_statuses 
FOR SELECT 
USING (organization_id IN (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can update lead statuses" 
ON public.lead_statuses 
FOR UPDATE 
USING (organization_id IN (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can delete lead statuses" 
ON public.lead_statuses 
FOR DELETE 
USING (organization_id IN (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

-- Update session_statuses policies to be organization-based
DROP POLICY IF EXISTS "Users can create their own session statuses" ON public.session_statuses;
DROP POLICY IF EXISTS "Users can view their own session statuses" ON public.session_statuses;
DROP POLICY IF EXISTS "Users can update their own session statuses" ON public.session_statuses;
DROP POLICY IF EXISTS "Users can delete their own non-system session statuses" ON public.session_statuses;

-- Add organization_id column to session_statuses if it doesn't exist
ALTER TABLE public.session_statuses ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Update existing session_statuses with organization_id
UPDATE public.session_statuses 
SET organization_id = (
  SELECT us.active_organization_id 
  FROM public.user_settings us 
  WHERE us.user_id = session_statuses.user_id
)
WHERE organization_id IS NULL;

CREATE POLICY "Organization members can create session statuses" 
ON public.session_statuses 
FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can view session statuses" 
ON public.session_statuses 
FOR SELECT 
USING (organization_id IN (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can update session statuses" 
ON public.session_statuses 
FOR UPDATE 
USING (organization_id IN (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can delete non-system session statuses" 
ON public.session_statuses 
FOR DELETE 
USING (organization_id IN (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.status = 'active'
) AND is_system_initial = false);

-- Update project_statuses policies to be organization-based
DROP POLICY IF EXISTS "Users can create their own project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Users can view their own project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Users can update their own project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Users can delete their own project statuses" ON public.project_statuses;

-- Add organization_id column to project_statuses if it doesn't exist
ALTER TABLE public.project_statuses ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Update existing project_statuses with organization_id
UPDATE public.project_statuses 
SET organization_id = (
  SELECT us.active_organization_id 
  FROM public.user_settings us 
  WHERE us.user_id = project_statuses.user_id
)
WHERE organization_id IS NULL;

CREATE POLICY "Organization members can create project statuses" 
ON public.project_statuses 
FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can view project statuses" 
ON public.project_statuses 
FOR SELECT 
USING (organization_id IN (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can update project statuses" 
ON public.project_statuses 
FOR UPDATE 
USING (organization_id IN (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can delete project statuses" 
ON public.project_statuses 
FOR DELETE 
USING (organization_id IN (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

-- Fix organization_members visibility - add policy for members to see other members
CREATE POLICY "Organization members can view other members" 
ON public.organization_members 
FOR SELECT 
USING (organization_id IN (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));