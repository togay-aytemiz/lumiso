-- Fix remaining infinite recursion issues in RLS policies

-- Drop problematic organization policies that cause recursion
DROP POLICY IF EXISTS "Organization members can view their organizations" ON public.organizations;

-- Create a simpler policy for organizations that doesn't cause recursion
CREATE POLICY "Organization members can view their organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  -- Direct check against organization_members without recursion
  id IN (
    SELECT om.organization_id
    FROM public.organization_members om
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
  )
);

-- Also fix the organization_members policy that still has recursion
DROP POLICY IF EXISTS "Organization members can view team members" ON public.organization_members;

-- Create a non-recursive policy for viewing team members
CREATE POLICY "Organization members can view team members"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  -- Allow users to see their own membership
  user_id = auth.uid()
  OR
  -- Allow viewing members of the same organization using a direct join
  organization_id IN (
    SELECT om2.organization_id
    FROM public.organization_members om2
    WHERE om2.user_id = auth.uid() 
    AND om2.status = 'active'
  )
  OR
  -- Allow organization owners to see all members
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_id
    AND o.owner_id = auth.uid()
  )
);