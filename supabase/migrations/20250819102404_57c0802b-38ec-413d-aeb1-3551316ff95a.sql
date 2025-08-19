-- Completely fix infinite recursion by removing all circular dependencies

-- Drop ALL problematic policies
DROP POLICY IF EXISTS "Organization members can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can manage their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Organization members can view team members" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners can manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Organization members can view other members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON public.organization_members;

-- Create simple, non-recursive policies for organizations
CREATE POLICY "Users can view organizations they own"
ON public.organizations
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Users can view organizations they belong to"
ON public.organizations
FOR SELECT  
TO authenticated
USING (
  id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

CREATE POLICY "Organization owners can manage their organizations"
ON public.organizations
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Create simple, non-recursive policies for organization_members
CREATE POLICY "Users can view their own membership"
ON public.organization_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Organization owners can view all members"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_id 
    AND o.owner_id = auth.uid()
  )
);

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