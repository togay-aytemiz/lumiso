-- Add organization_id to project_types table if it doesn't exist
ALTER TABLE public.project_types 
ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Update existing project_types to use organization_id
UPDATE public.project_types 
SET organization_id = (
  SELECT get_user_organization_id()
  FROM public.organization_members om 
  WHERE om.user_id = project_types.user_id 
  AND om.status = 'active'
  LIMIT 1
)
WHERE organization_id IS NULL;

-- Update RLS policies for project_types to be organization-based
DROP POLICY IF EXISTS "Users can create their own project types" ON public.project_types;
DROP POLICY IF EXISTS "Users can view their own project types" ON public.project_types;
DROP POLICY IF EXISTS "Users can update their own project types" ON public.project_types;
DROP POLICY IF EXISTS "Users can delete their own project types" ON public.project_types;

-- Create new organization-based RLS policies for project_types
CREATE POLICY "Organization members can create project types" 
ON public.project_types 
FOR INSERT 
WITH CHECK (organization_id = ANY (get_user_organization_ids()));

CREATE POLICY "Organization members can view project types" 
ON public.project_types 
FOR SELECT 
USING (organization_id = ANY (get_user_organization_ids()));

CREATE POLICY "Organization members can update project types" 
ON public.project_types 
FOR UPDATE 
USING (organization_id = ANY (get_user_organization_ids()));

CREATE POLICY "Organization members can delete project types" 
ON public.project_types 
FOR DELETE 
USING (organization_id = ANY (get_user_organization_ids()));

-- Create function to ensure default project types for organization
CREATE OR REPLACE FUNCTION public.ensure_default_project_types_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  type_count INTEGER;
BEGIN
  -- Check if organization already has project types
  SELECT COUNT(*) INTO type_count 
  FROM public.project_types 
  WHERE organization_id = org_id;
  
  -- Only create defaults if no types exist for this organization
  IF type_count = 0 THEN
    INSERT INTO public.project_types (user_id, organization_id, name, is_default, sort_order) VALUES
      (user_uuid, org_id, 'Corporate', false, 1),
      (user_uuid, org_id, 'Event', false, 2),
      (user_uuid, org_id, 'Family', false, 3),
      (user_uuid, org_id, 'Maternity', false, 4),
      (user_uuid, org_id, 'Newborn', true, 5),
      (user_uuid, org_id, 'Portrait', false, 6),
      (user_uuid, org_id, 'Wedding', false, 7),
      (user_uuid, org_id, 'Other', false, 8);
  END IF;
END;
$$;