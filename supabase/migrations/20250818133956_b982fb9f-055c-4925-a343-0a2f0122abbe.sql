-- Update RLS policies to allow organization members to see shared data
-- First, create a helper function to get user's organization ID
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id 
  FROM public.organization_members 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$;

-- Update leads policies to allow organization access
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can create their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete their own leads" ON public.leads;

CREATE POLICY "Organization members can view leads" ON public.leads
FOR SELECT USING (
  user_id IN (
    SELECT user_id FROM public.organization_members 
    WHERE organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Organization members can create leads" ON public.leads
FOR INSERT WITH CHECK (
  user_id IN (
    SELECT user_id FROM public.organization_members 
    WHERE organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Organization members can update leads" ON public.leads
FOR UPDATE USING (
  user_id IN (
    SELECT user_id FROM public.organization_members 
    WHERE organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Organization members can delete leads" ON public.leads
FOR DELETE USING (
  user_id IN (
    SELECT user_id FROM public.organization_members 
    WHERE organization_id = public.get_user_organization_id()
  )
);

-- Update projects policies to allow organization access
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

CREATE POLICY "Organization members can view projects" ON public.projects
FOR SELECT USING (
  user_id IN (
    SELECT user_id FROM public.organization_members 
    WHERE organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Organization members can create projects" ON public.projects
FOR INSERT WITH CHECK (
  user_id IN (
    SELECT user_id FROM public.organization_members 
    WHERE organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Organization members can update projects" ON public.projects
FOR UPDATE USING (
  user_id IN (
    SELECT user_id FROM public.organization_members 
    WHERE organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Organization members can delete projects" ON public.projects
FOR DELETE USING (
  user_id IN (
    SELECT user_id FROM public.organization_members 
    WHERE organization_id = public.get_user_organization_id()
  )
);

-- Update sessions policies to allow organization access
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can create their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.sessions;

CREATE POLICY "Organization members can view sessions" ON public.sessions
FOR SELECT USING (
  user_id IN (
    SELECT user_id FROM public.organization_members 
    WHERE organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Organization members can create sessions" ON public.sessions
FOR INSERT WITH CHECK (
  user_id IN (
    SELECT user_id FROM public.organization_members 
    WHERE organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Organization members can update sessions" ON public.sessions
FOR UPDATE USING (
  user_id IN (
    SELECT user_id FROM public.organization_members 
    WHERE organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Organization members can delete sessions" ON public.sessions
FOR DELETE USING (
  user_id IN (
    SELECT user_id FROM public.organization_members 
    WHERE organization_id = public.get_user_organization_id()
  )
);

-- Update activities policies to allow organization access
DROP POLICY IF EXISTS "Users can view their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can create their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON public.activities;

CREATE POLICY "Organization members can view activities" ON public.activities
FOR SELECT USING (
  user_id IN (
    SELECT user_id FROM public.organization_members 
    WHERE organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Organization members can create activities" ON public.activities
FOR INSERT WITH CHECK (
  user_id IN (
    SELECT user_id FROM public.organization_members 
    WHERE organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Organization members can update activities" ON public.activities
FOR UPDATE USING (
  user_id IN (
    SELECT user_id FROM public.organization_members 
    WHERE organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Organization members can delete activities" ON public.activities
FOR DELETE USING (
  user_id IN (
    SELECT user_id FROM public.organization_members 
    WHERE organization_id = public.get_user_organization_id()
  )
);