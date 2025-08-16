-- Add RLS policy to allow viewing invitations by invitation ID without requiring organization membership
-- This is needed so people can view invitation details before accepting (they're not members yet)

CREATE POLICY "Anyone can view invitations by ID for acceptance"
ON public.invitations 
FOR SELECT 
USING (true);

-- Drop the existing restrictive policy that requires organization membership
DROP POLICY IF EXISTS "Members can view their organization invitations" ON public.invitations;