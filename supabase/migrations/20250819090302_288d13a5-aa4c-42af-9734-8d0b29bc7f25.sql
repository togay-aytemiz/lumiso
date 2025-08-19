-- Fix infinite recursion by creating a security definer function
-- This function can safely check organization membership without triggering RLS

CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS uuid[]
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ARRAY_AGG(organization_id)
  FROM public.organization_members 
  WHERE user_id = auth.uid() AND status = 'active';
$$;

-- Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "Organization members can create lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Organization members can view lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Organization members can update lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Organization members can delete lead statuses" ON public.lead_statuses;

DROP POLICY IF EXISTS "Organization members can create session statuses" ON public.session_statuses;
DROP POLICY IF EXISTS "Organization members can view session statuses" ON public.session_statuses;
DROP POLICY IF EXISTS "Organization members can update session statuses" ON public.session_statuses;
DROP POLICY IF EXISTS "Organization members can delete non-system session statuses" ON public.session_statuses;

DROP POLICY IF EXISTS "Organization members can create project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Organization members can view project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Organization members can update project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Organization members can delete project statuses" ON public.project_statuses;

DROP POLICY IF EXISTS "Organization members can view other members" ON public.organization_members;

-- Create new policies using the security definer function
-- Lead statuses policies
CREATE POLICY "Organization members can create lead statuses" 
ON public.lead_statuses 
FOR INSERT 
WITH CHECK (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "Organization members can view lead statuses" 
ON public.lead_statuses 
FOR SELECT 
USING (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "Organization members can update lead statuses" 
ON public.lead_statuses 
FOR UPDATE 
USING (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "Organization members can delete lead statuses" 
ON public.lead_statuses 
FOR DELETE 
USING (organization_id = ANY(public.get_user_organization_ids()));

-- Session statuses policies
CREATE POLICY "Organization members can create session statuses" 
ON public.session_statuses 
FOR INSERT 
WITH CHECK (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "Organization members can view session statuses" 
ON public.session_statuses 
FOR SELECT 
USING (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "Organization members can update session statuses" 
ON public.session_statuses 
FOR UPDATE 
USING (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "Organization members can delete non-system session statuses" 
ON public.session_statuses 
FOR DELETE 
USING (organization_id = ANY(public.get_user_organization_ids()) AND is_system_initial = false);

-- Project statuses policies
CREATE POLICY "Organization members can create project statuses" 
ON public.project_statuses 
FOR INSERT 
WITH CHECK (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "Organization members can view project statuses" 
ON public.project_statuses 
FOR SELECT 
USING (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "Organization members can update project statuses" 
ON public.project_statuses 
FOR UPDATE 
USING (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "Organization members can delete project statuses" 
ON public.project_statuses 
FOR DELETE 
USING (organization_id = ANY(public.get_user_organization_ids()));

-- Fix organization members policies to avoid recursion
-- Create a simple function for checking organization ownership
CREATE OR REPLACE FUNCTION public.user_is_organization_owner(org_id uuid)
RETURNS boolean
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = org_id AND owner_id = auth.uid()
  );
$$;

-- Update organization_members policies to use the function
CREATE POLICY "Organization members can view other members" 
ON public.organization_members 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  public.user_is_organization_owner(organization_id)
);