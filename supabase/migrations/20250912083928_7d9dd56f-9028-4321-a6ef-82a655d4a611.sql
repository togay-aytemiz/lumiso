-- Insert default permissions if they don't exist
INSERT INTO public.permissions (name, description, category) VALUES
  -- Lead Management
  ('view_assigned_leads', 'Can view leads assigned to them', 'Lead Management'),
  ('edit_assigned_leads', 'Can edit leads assigned to them', 'Lead Management'),
  ('manage_all_leads', 'Can view and edit all leads in organization', 'Lead Management'),
  ('create_leads', 'Can create new leads', 'Lead Management'),
  ('delete_leads', 'Can delete leads', 'Lead Management'),
  
  -- Project Management  
  ('view_assigned_projects', 'Can view projects assigned to them', 'Project Management'),
  ('edit_assigned_projects', 'Can edit projects assigned to them', 'Project Management'),
  ('manage_all_projects', 'Can view and edit all projects in organization', 'Project Management'),
  ('create_projects', 'Can create new projects', 'Project Management'),
  ('delete_projects', 'Can delete projects', 'Project Management'),
  
  -- Session Management
  ('manage_sessions', 'Can create, edit and manage photography sessions', 'Session Management'),
  ('view_sessions', 'Can view photography sessions', 'Session Management'),
  
  -- Settings & Administration
  ('manage_organization_settings', 'Can modify organization settings', 'Administration'),
  ('manage_team', 'Can invite and manage team members', 'Administration'),
  ('manage_roles', 'Can create and manage custom roles', 'Administration'),
  ('view_analytics', 'Can view organization analytics and reports', 'Administration')

ON CONFLICT (name) DO NOTHING;

-- Create a default "Member" custom role for each organization that doesn't have one
INSERT INTO public.custom_roles (organization_id, name, description, sort_order)
SELECT 
  o.id as organization_id,
  'Team Member' as name,
  'Standard team member with basic access to assigned items' as description,
  1 as sort_order
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.custom_roles cr 
  WHERE cr.organization_id = o.id 
  AND LOWER(cr.name) = 'team member'
);

-- Add default permissions to the new "Team Member" roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  cr.id as role_id,
  p.id as permission_id
FROM public.custom_roles cr
CROSS JOIN public.permissions p
WHERE cr.name = 'Team Member'
  AND p.name IN ('view_assigned_leads', 'view_assigned_projects', 'view_sessions')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp 
    WHERE rp.role_id = cr.id AND rp.permission_id = p.id
  );