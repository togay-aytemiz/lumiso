-- Update existing project types to use the current organization ID
-- This will make them visible in the new organization-based system

UPDATE public.project_types 
SET organization_id = '86b098a8-2fd5-4ad6-9dbf-757d656b307b'
WHERE user_id = 'ac32273e-af95-4de9-abed-ce96e6f68139' 
AND organization_id IS NULL;