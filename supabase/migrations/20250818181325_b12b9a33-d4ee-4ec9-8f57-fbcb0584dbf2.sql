-- Fix sessions RLS - add organization_id column to sessions table
ALTER TABLE public.sessions ADD COLUMN organization_id UUID;

-- Update existing sessions to have the organization_id from their associated lead
UPDATE public.sessions 
SET organization_id = (
  SELECT l.organization_id 
  FROM public.leads l 
  WHERE l.id = sessions.lead_id
);

-- For sessions without lead_id, use their user's active organization
UPDATE public.sessions 
SET organization_id = (
  SELECT us.active_organization_id 
  FROM public.user_settings us 
  WHERE us.user_id = sessions.user_id
)
WHERE organization_id IS NULL;

-- If still null, use the user's own organization (for edge cases)
UPDATE public.sessions 
SET organization_id = (
  SELECT om.organization_id 
  FROM public.organization_members om 
  WHERE om.user_id = sessions.user_id 
  AND om.status = 'active' 
  ORDER BY om.joined_at ASC 
  LIMIT 1
)
WHERE organization_id IS NULL;

-- Make organization_id NOT NULL for future records
ALTER TABLE public.sessions ALTER COLUMN organization_id SET NOT NULL;

-- Drop old session policies
DROP POLICY IF EXISTS "Organization members can create sessions" ON public.sessions;
DROP POLICY IF EXISTS "Organization members can view sessions" ON public.sessions;
DROP POLICY IF EXISTS "Organization members can update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Organization members can delete sessions" ON public.sessions;
DROP POLICY IF EXISTS "Test - Organization members can view sessions" ON public.sessions;

-- Create new organization-based policies for sessions
CREATE POLICY "Organization members can view sessions" 
ON public.sessions FOR SELECT 
USING (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can create sessions" 
ON public.sessions FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can update sessions" 
ON public.sessions FOR UPDATE 
USING (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can delete sessions" 
ON public.sessions FOR DELETE 
USING (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));