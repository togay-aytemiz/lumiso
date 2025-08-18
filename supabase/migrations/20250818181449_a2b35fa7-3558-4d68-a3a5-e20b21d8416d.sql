-- Check and fix sessions table - only update policies since organization_id already exists
-- Update existing sessions to have the correct organization_id

UPDATE public.sessions 
SET organization_id = (
  SELECT l.organization_id 
  FROM public.leads l 
  WHERE l.id = sessions.lead_id
)
WHERE organization_id IS NULL;

-- Update sessions without lead_id to use their user's active organization
UPDATE public.sessions 
SET organization_id = (
  SELECT us.active_organization_id 
  FROM public.user_settings us 
  WHERE us.user_id = sessions.user_id
)
WHERE organization_id IS NULL;

-- Drop old session policies and create new ones
DROP POLICY IF EXISTS "Organization members can create sessions" ON public.sessions;
DROP POLICY IF EXISTS "Organization members can view sessions" ON public.sessions;
DROP POLICY IF EXISTS "Organization members can update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Organization members can delete sessions" ON public.sessions;
DROP POLICY IF EXISTS "Test - Organization members can view sessions" ON public.sessions;

-- Create new organization-based policies for sessions
CREATE POLICY "Organization members can view sessions" 
ON public.sessions FOR SELECT 
USING (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can create sessions" 
ON public.sessions FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can update sessions" 
ON public.sessions FOR UPDATE 
USING (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can delete sessions" 
ON public.sessions FOR DELETE 
USING (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

-- Check if organization_id columns exist before adding them, then update settings tables
-- Add organization_id to settings tables if they don't have it
DO $$ 
BEGIN
    -- Project Types
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_types' AND column_name = 'organization_id') THEN
        ALTER TABLE public.project_types ADD COLUMN organization_id UUID;
        UPDATE public.project_types SET organization_id = (
          SELECT us.active_organization_id 
          FROM public.user_settings us 
          WHERE us.user_id = project_types.user_id
        );
        ALTER TABLE public.project_types ALTER COLUMN organization_id SET NOT NULL;
    END IF;

    -- Project Statuses  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_statuses' AND column_name = 'organization_id') THEN
        ALTER TABLE public.project_statuses ADD COLUMN organization_id UUID;
        UPDATE public.project_statuses SET organization_id = (
          SELECT us.active_organization_id 
          FROM public.user_settings us 
          WHERE us.user_id = project_statuses.user_id
        );
        ALTER TABLE public.project_statuses ALTER COLUMN organization_id SET NOT NULL;
    END IF;

    -- Lead Statuses
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lead_statuses' AND column_name = 'organization_id') THEN
        ALTER TABLE public.lead_statuses ADD COLUMN organization_id UUID;
        UPDATE public.lead_statuses SET organization_id = (
          SELECT us.active_organization_id 
          FROM public.user_settings us 
          WHERE us.user_id = lead_statuses.user_id
        );
        ALTER TABLE public.lead_statuses ALTER COLUMN organization_id SET NOT NULL;
    END IF;

    -- Session Statuses
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_statuses' AND column_name = 'organization_id') THEN
        ALTER TABLE public.session_statuses ADD COLUMN organization_id UUID;
        UPDATE public.session_statuses SET organization_id = (
          SELECT us.active_organization_id 
          FROM public.user_settings us 
          WHERE us.user_id = session_statuses.user_id
        );
        ALTER TABLE public.session_statuses ALTER COLUMN organization_id SET NOT NULL;
    END IF;
END $$;

-- Update RLS policies for settings tables to be organization-based
-- Project Types
DROP POLICY IF EXISTS "Users can view their own project types" ON public.project_types;
DROP POLICY IF EXISTS "Users can create their own project types" ON public.project_types;
DROP POLICY IF EXISTS "Users can update their own project types" ON public.project_types;
DROP POLICY IF EXISTS "Users can delete their own project types" ON public.project_types;

CREATE POLICY "Organization members can view project types" ON public.project_types FOR SELECT 
USING (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active'));

CREATE POLICY "Organization members can create project types" ON public.project_types FOR INSERT 
WITH CHECK (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active'));

CREATE POLICY "Organization members can update project types" ON public.project_types FOR UPDATE 
USING (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active'));

CREATE POLICY "Organization members can delete project types" ON public.project_types FOR DELETE 
USING (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active'));

-- Project Statuses
DROP POLICY IF EXISTS "Users can view their own project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Users can create their own project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Users can update their own project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Users can delete their own project statuses" ON public.project_statuses;

CREATE POLICY "Organization members can view project statuses" ON public.project_statuses FOR SELECT 
USING (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active'));

CREATE POLICY "Organization members can create project statuses" ON public.project_statuses FOR INSERT 
WITH CHECK (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active'));

CREATE POLICY "Organization members can update project statuses" ON public.project_statuses FOR UPDATE 
USING (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active'));

CREATE POLICY "Organization members can delete project statuses" ON public.project_statuses FOR DELETE 
USING (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active'));

-- Lead Statuses
DROP POLICY IF EXISTS "Users can view their own lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Users can create their own lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Users can update their own lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Users can delete their own lead statuses" ON public.lead_statuses;

CREATE POLICY "Organization members can view lead statuses" ON public.lead_statuses FOR SELECT 
USING (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active'));

CREATE POLICY "Organization members can create lead statuses" ON public.lead_statuses FOR INSERT 
WITH CHECK (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active'));

CREATE POLICY "Organization members can update lead statuses" ON public.lead_statuses FOR UPDATE 
USING (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active'));

CREATE POLICY "Organization members can delete lead statuses" ON public.lead_statuses FOR DELETE 
USING (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active'));

-- Session Statuses
DROP POLICY IF EXISTS "Users can view their own session statuses" ON public.session_statuses;
DROP POLICY IF EXISTS "Users can create their own session statuses" ON public.session_statuses;
DROP POLICY IF EXISTS "Users can update their own session statuses" ON public.session_statuses;
DROP POLICY IF EXISTS "Users can delete their own non-system session statuses" ON public.session_statuses;

CREATE POLICY "Organization members can view session statuses" ON public.session_statuses FOR SELECT 
USING (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active'));

CREATE POLICY "Organization members can create session statuses" ON public.session_statuses FOR INSERT 
WITH CHECK (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active'));

CREATE POLICY "Organization members can update session statuses" ON public.session_statuses FOR UPDATE 
USING (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active'));

CREATE POLICY "Organization members can delete session statuses" ON public.session_statuses FOR DELETE 
USING (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active') AND is_system_initial = false);