-- Fix organization_members RLS policies for team visibility
-- The current policies incorrectly check auth.uid() = organization_id which doesn't make sense

-- Drop the incorrect policies
DROP POLICY IF EXISTS "Organization owners can delete members" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners can insert members" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners can update members" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners can view all members" ON public.organization_members;

-- Create correct policies that check against organization ownership
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

-- Create policy for organization members to view other members in the same organization
CREATE POLICY "Organization members can view team members"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM public.organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- Add column to organization_settings for show_quick_status_buttons
ALTER TABLE public.organization_settings 
ADD COLUMN IF NOT EXISTS show_quick_status_buttons boolean DEFAULT true;