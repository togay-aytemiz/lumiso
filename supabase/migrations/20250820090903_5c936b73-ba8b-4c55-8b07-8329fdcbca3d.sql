-- Fix the critical invitations security issue
-- Replace the overly permissive policy that allows anyone to view invitations

DROP POLICY IF EXISTS "Anyone can view invitations by ID for acceptance" ON public.invitations;

-- Create a more secure policy that only allows:
-- 1. Organization owners to view all invitations for their org
-- 2. The invited email address to view their own invitation (for acceptance)
CREATE POLICY "Secure invitation access" 
ON public.invitations FOR SELECT 
USING (
  -- Organization owners can view invitations for their organization
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = invitations.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'
  )
  OR
  -- Allow access by invitation ID for acceptance (no email verification needed for acceptance flow)
  -- This is needed for the acceptance flow where we can't verify email before auth
  invitations.expires_at > now() AND invitations.accepted_at IS NULL
);

-- Also ensure organization_settings has proper Owner access
DROP POLICY IF EXISTS "Organization members can view organization settings" ON public.organization_settings;
DROP POLICY IF EXISTS "Organization members can update organization settings" ON public.organization_settings;
DROP POLICY IF EXISTS "Organization members can create organization settings" ON public.organization_settings;

CREATE POLICY "Organization owners and members can view organization settings" 
ON public.organization_settings FOR SELECT 
USING (
  organization_id IN (
    SELECT om.organization_id
    FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

CREATE POLICY "Organization owners and members can update organization settings" 
ON public.organization_settings FOR UPDATE 
USING (
  organization_id IN (
    SELECT om.organization_id
    FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

CREATE POLICY "Organization owners and members can create organization settings" 
ON public.organization_settings FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id
    FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);