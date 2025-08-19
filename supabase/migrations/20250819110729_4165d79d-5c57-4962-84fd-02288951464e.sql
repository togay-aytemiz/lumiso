-- Create default Member role with appropriate permissions for each organization
INSERT INTO public.custom_roles (organization_id, name, description, sort_order)
SELECT 
  o.id as organization_id,
  'Member' as name,
  'Default member role with basic access' as description,
  1 as sort_order
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.custom_roles cr 
  WHERE cr.organization_id = o.id AND cr.name = 'Member'
);

-- Assign basic permissions to default Member role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  cr.id as role_id,
  p.id as permission_id
FROM public.custom_roles cr
CROSS JOIN public.permissions p
WHERE cr.name = 'Member'
AND p.name IN (
  'view_assigned_projects',
  'edit_assigned_projects', 
  'create_projects',
  'view_assigned_leads',
  'edit_assigned_leads',
  'create_leads',
  'view_assigned_sessions',
  'edit_assigned_sessions',
  'create_sessions',
  'view_payments',
  'view_services'
)
ON CONFLICT DO NOTHING;

-- Update existing organization members without custom roles to use the default Member role
UPDATE public.organization_members 
SET custom_role_id = (
  SELECT cr.id 
  FROM public.custom_roles cr 
  WHERE cr.organization_id = organization_members.organization_id 
  AND cr.name = 'Member'
)
WHERE custom_role_id IS NULL 
AND system_role = 'Member';