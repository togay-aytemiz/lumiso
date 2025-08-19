-- Fix projects RLS policies to work with updated organization_members policies

-- Drop existing project policies
DROP POLICY IF EXISTS "Organization members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Organization members can create projects" ON public.projects;
DROP POLICY IF EXISTS "Organization members can update projects" ON public.projects;
DROP POLICY IF EXISTS "Organization members can delete projects" ON public.projects;

-- Create new project policies that work with the updated organization structure
CREATE POLICY "Organization members can view projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  -- Allow viewing projects in user's active organization
  organization_id IN (
    SELECT active_organization_id
    FROM public.user_settings
    WHERE user_id = auth.uid()
    AND active_organization_id IS NOT NULL
  )
  OR
  -- Allow organization owners to view all their organization's projects
  organization_id IN (
    SELECT id FROM public.organizations 
    WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Organization members can create projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT active_organization_id
    FROM public.user_settings
    WHERE user_id = auth.uid()
    AND active_organization_id IS NOT NULL
  )
  OR
  organization_id IN (
    SELECT id FROM public.organizations 
    WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Organization members can update projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT active_organization_id
    FROM public.user_settings
    WHERE user_id = auth.uid()
    AND active_organization_id IS NOT NULL
  )
  OR
  organization_id IN (
    SELECT id FROM public.organizations 
    WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Organization members can delete projects"
ON public.projects
FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT active_organization_id
    FROM public.user_settings
    WHERE user_id = auth.uid()
    AND active_organization_id IS NOT NULL
  )
  OR
  organization_id IN (
    SELECT id FROM public.organizations 
    WHERE owner_id = auth.uid()
  )
);