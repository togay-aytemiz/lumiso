-- FINAL FIX: Remove ALL circular dependencies

-- Drop ALL organization policies
DROP POLICY IF EXISTS "Users can view organizations they own" ON public.organizations;
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can manage their organizations" ON public.organizations;

-- Drop ALL organization_members policies  
DROP POLICY IF EXISTS "Users can view their own membership" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners can view all members" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners can manage members" ON public.organization_members;

-- Create ONLY owner-based policies for organizations (NO reference to organization_members)
CREATE POLICY "Organization owners can manage their organizations"
ON public.organizations
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Create organization_members policies that DON'T reference organizations table
CREATE POLICY "Users can view their own membership"
ON public.organization_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Use user_settings active_organization_id directly to avoid circular reference
CREATE POLICY "Members can view team in active organization"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT active_organization_id
    FROM public.user_settings
    WHERE user_id = auth.uid()
    AND active_organization_id IS NOT NULL
  )
);

CREATE POLICY "Organization owners can manage members"
ON public.organization_members
FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT id FROM public.organizations 
    WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT id FROM public.organizations 
    WHERE owner_id = auth.uid()
  )
);