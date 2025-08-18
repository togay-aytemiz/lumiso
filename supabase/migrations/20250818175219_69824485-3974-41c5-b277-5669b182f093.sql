-- Add organization_id columns to leads and projects tables
-- This will allow team members to share data within organizations

-- Add organization_id to leads table
ALTER TABLE public.leads ADD COLUMN organization_id uuid;

-- Add organization_id to projects table  
ALTER TABLE public.projects ADD COLUMN organization_id uuid;

-- Populate organization_id for existing leads based on user's organization
UPDATE public.leads 
SET organization_id = (
  SELECT om.organization_id 
  FROM public.organization_members om 
  WHERE om.user_id = leads.user_id 
  AND om.status = 'active'
  LIMIT 1
);

-- Populate organization_id for existing projects based on user's organization
UPDATE public.projects 
SET organization_id = (
  SELECT om.organization_id 
  FROM public.organization_members om 
  WHERE om.user_id = projects.user_id 
  AND om.status = 'active'
  LIMIT 1
);

-- Make organization_id NOT NULL for future records
ALTER TABLE public.leads ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.projects ALTER COLUMN organization_id SET NOT NULL;

-- Update RLS policies for leads to use organization_id directly
DROP POLICY IF EXISTS "Organization members can view leads" ON public.leads;
DROP POLICY IF EXISTS "Organization members can create leads" ON public.leads;
DROP POLICY IF EXISTS "Organization members can update leads" ON public.leads;
DROP POLICY IF EXISTS "Organization members can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Test - Organization members can view leads" ON public.leads;

CREATE POLICY "Organization members can view leads" ON public.leads
FOR SELECT USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM public.organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

CREATE POLICY "Organization members can create leads" ON public.leads
FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT om.organization_id 
    FROM public.organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

CREATE POLICY "Organization members can update leads" ON public.leads
FOR UPDATE USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM public.organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

CREATE POLICY "Organization members can delete leads" ON public.leads
FOR DELETE USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM public.organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- Update RLS policies for projects to use organization_id directly
DROP POLICY IF EXISTS "Organization members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Organization members can create projects" ON public.projects;
DROP POLICY IF EXISTS "Organization members can update projects" ON public.projects;
DROP POLICY IF EXISTS "Organization members can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Test - Organization members can view projects" ON public.projects;

CREATE POLICY "Organization members can view projects" ON public.projects
FOR SELECT USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM public.organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

CREATE POLICY "Organization members can create projects" ON public.projects
FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT om.organization_id 
    FROM public.organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

CREATE POLICY "Organization members can update projects" ON public.projects
FOR UPDATE USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM public.organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

CREATE POLICY "Organization members can delete projects" ON public.projects
FOR DELETE USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM public.organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- Update activities table policies to use organization_id from leads/projects
DROP POLICY IF EXISTS "Organization members can view activities" ON public.activities;
DROP POLICY IF EXISTS "Organization members can create activities" ON public.activities;
DROP POLICY IF EXISTS "Organization members can update activities" ON public.activities;
DROP POLICY IF EXISTS "Organization members can delete activities" ON public.activities;
DROP POLICY IF EXISTS "Test - Organization members can view activities" ON public.activities;

CREATE POLICY "Organization members can view activities" ON public.activities
FOR SELECT USING (
  CASE 
    WHEN lead_id IS NOT NULL THEN 
      lead_id IN (
        SELECT l.id FROM public.leads l 
        JOIN public.organization_members om ON l.organization_id = om.organization_id
        WHERE om.user_id = auth.uid() AND om.status = 'active'
      )
    WHEN project_id IS NOT NULL THEN 
      project_id IN (
        SELECT p.id FROM public.projects p 
        JOIN public.organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid() AND om.status = 'active'
      )
    ELSE false
  END
);

CREATE POLICY "Organization members can create activities" ON public.activities
FOR INSERT WITH CHECK (
  CASE 
    WHEN lead_id IS NOT NULL THEN 
      lead_id IN (
        SELECT l.id FROM public.leads l 
        JOIN public.organization_members om ON l.organization_id = om.organization_id
        WHERE om.user_id = auth.uid() AND om.status = 'active'
      )
    WHEN project_id IS NOT NULL THEN 
      project_id IN (
        SELECT p.id FROM public.projects p 
        JOIN public.organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid() AND om.status = 'active'
      )
    ELSE false
  END
);

CREATE POLICY "Organization members can update activities" ON public.activities
FOR UPDATE USING (
  CASE 
    WHEN lead_id IS NOT NULL THEN 
      lead_id IN (
        SELECT l.id FROM public.leads l 
        JOIN public.organization_members om ON l.organization_id = om.organization_id
        WHERE om.user_id = auth.uid() AND om.status = 'active'
      )
    WHEN project_id IS NOT NULL THEN 
      project_id IN (
        SELECT p.id FROM public.projects p 
        JOIN public.organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid() AND om.status = 'active'
      )
    ELSE false
  END
);

CREATE POLICY "Organization members can delete activities" ON public.activities
FOR DELETE USING (
  CASE 
    WHEN lead_id IS NOT NULL THEN 
      lead_id IN (
        SELECT l.id FROM public.leads l 
        JOIN public.organization_members om ON l.organization_id = om.organization_id
        WHERE om.user_id = auth.uid() AND om.status = 'active'
      )
    WHEN project_id IS NOT NULL THEN 
      project_id IN (
        SELECT p.id FROM public.projects p 
        JOIN public.organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid() AND om.status = 'active'
      )
    ELSE false
  END
);