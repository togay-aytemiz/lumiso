-- Add preset role templates table
CREATE TABLE public.role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing templates
CREATE POLICY "Anyone can view role templates" 
ON public.role_templates 
FOR SELECT 
USING (true);

-- Insert preset role templates
INSERT INTO public.role_templates (name, description, permissions, sort_order, is_system) VALUES
  ('Full Admin', 'Complete access to all features and settings', ARRAY[
    'manage_all_leads', 'create_leads', 'delete_leads',
    'manage_all_projects', 'create_projects', 'delete_projects',
    'manage_session_statuses', 'manage_project_statuses', 'manage_lead_statuses',
    'manage_services', 'manage_packages', 'manage_project_types',
    'manage_team', 'manage_roles', 'admin', 'manage_integrations', 'manage_contracts', 'manage_billing', 'manage_client_messaging'
  ], 1, true),
  
  ('Project Manager', 'Can manage all projects and leads, limited settings access', ARRAY[
    'manage_all_leads', 'create_leads',
    'manage_all_projects', 'create_projects', 
    'view_lead_statuses', 'view_project_statuses', 'view_session_statuses',
    'view_services', 'view_packages', 'view_project_types'
  ], 2, true),
  
  ('Team Member', 'Can work on assigned projects and leads', ARRAY[
    'view_assigned_leads', 'edit_assigned_leads', 'create_leads',
    'view_assigned_projects', 'edit_assigned_projects', 'create_projects',
    'view_lead_statuses', 'view_project_statuses', 'view_session_statuses',
    'view_services', 'view_packages', 'view_project_types'
  ], 3, true),
  
  ('Viewer', 'Read-only access to assigned items', ARRAY[
    'view_assigned_leads', 'view_assigned_projects',
    'view_lead_statuses', 'view_project_statuses', 'view_session_statuses',
    'view_services', 'view_packages', 'view_project_types'
  ], 4, true);

-- Add template_id column to custom_roles table
ALTER TABLE public.custom_roles ADD COLUMN template_id UUID REFERENCES public.role_templates(id);

-- Add index for better performance
CREATE INDEX idx_custom_roles_template_id ON public.custom_roles(template_id);
CREATE INDEX idx_role_templates_sort_order ON public.role_templates(sort_order);