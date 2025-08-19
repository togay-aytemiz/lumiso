-- Fix infinite recursion in organization_members RLS policies
-- Create a security definer function to check organization membership without recursion

CREATE OR REPLACE FUNCTION public.user_is_organization_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = org_id 
    AND user_id = auth.uid() 
    AND status = 'active'
  );
$$;

-- Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "Organization members can view team members" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners can manage members" ON public.organization_members;

-- Create new policies using the security definer function
CREATE POLICY "Organization owners can manage members"
ON public.organization_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_id 
    AND o.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_id 
    AND o.owner_id = auth.uid()
  )
);

-- Create a simpler policy for members to view other members
-- Using direct comparison to avoid recursion
CREATE POLICY "Organization members can view team members"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  -- Allow users to see members of organizations they belong to
  organization_id IN (
    SELECT user_settings.active_organization_id
    FROM public.user_settings
    WHERE user_settings.user_id = auth.uid()
  )
  OR
  -- Allow organization owners to see all members
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = organization_id
    AND organizations.owner_id = auth.uid()
  )
);