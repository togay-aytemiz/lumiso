-- Fix invitation role constraint by correcting RLS policies to use system_role instead of role
-- This migration resolves the "cannot alter type of a column used in a policy definition" error

-- 1) Drop problematic invitation policies that check role column directly
DROP POLICY IF EXISTS "Owners can delete invitations" ON public.invitations;
DROP POLICY IF EXISTS "Owners can insert invitations" ON public.invitations;
DROP POLICY IF EXISTS "Owners can update invitations" ON public.invitations;

-- 2) Drop the constraint that was preventing text roles
ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_role_check;

-- 3) Recreate proper invitation policies using system_role enum
CREATE POLICY "Owners can delete invitations" 
ON public.invitations 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = invitations.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'::system_role
  )
);

CREATE POLICY "Owners can insert invitations" 
ON public.invitations 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = invitations.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'::system_role
  )
);

CREATE POLICY "Owners can update invitations" 
ON public.invitations 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = invitations.organization_id 
    AND om.user_id = auth.uid() 
    AND om.system_role = 'Owner'::system_role
  )
);

-- 4) Also drop check constraint on organization_members.role if it exists
ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;