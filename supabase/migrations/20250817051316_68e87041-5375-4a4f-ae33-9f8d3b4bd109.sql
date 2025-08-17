-- Create custom roles table
CREATE TABLE public.custom_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Create permissions table
CREATE TABLE public.permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create role permissions junction table
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Enable RLS on all tables
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for custom_roles
CREATE POLICY "Organization owners can manage custom roles"
ON public.custom_roles
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.organization_members 
  WHERE organization_id = custom_roles.organization_id 
  AND user_id = auth.uid() 
  AND role = 'Owner'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.organization_members 
  WHERE organization_id = custom_roles.organization_id 
  AND user_id = auth.uid() 
  AND role = 'Owner'
));

-- RLS policies for permissions (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view permissions"
ON public.permissions
FOR SELECT
TO authenticated
USING (true);

-- RLS policies for role_permissions
CREATE POLICY "Organization owners can manage role permissions"
ON public.role_permissions
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.custom_roles cr
  JOIN public.organization_members om ON cr.organization_id = om.organization_id
  WHERE cr.id = role_permissions.role_id 
  AND om.user_id = auth.uid() 
  AND om.role = 'Owner'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.custom_roles cr
  JOIN public.organization_members om ON cr.organization_id = om.organization_id
  WHERE cr.id = role_permissions.role_id 
  AND om.user_id = auth.uid() 
  AND om.role = 'Owner'
));

-- Add custom_role_id to organization_members
ALTER TABLE public.organization_members 
ADD COLUMN custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- Insert default permissions
INSERT INTO public.permissions (name, description, category) VALUES
  ('view_team', 'View team members', 'Team Management'),
  ('invite_members', 'Invite new team members', 'Team Management'),
  ('remove_members', 'Remove team members', 'Team Management'),
  ('manage_roles', 'Manage roles and permissions', 'Team Management'),
  ('view_billing', 'View billing information', 'Billing'),
  ('manage_billing', 'Manage billing and payments', 'Billing'),
  ('view_settings', 'View organization settings', 'Settings'),
  ('manage_settings', 'Manage organization settings', 'Settings'),
  ('view_projects', 'View all projects', 'Projects'),
  ('manage_projects', 'Create and edit projects', 'Projects'),
  ('view_leads', 'View all leads', 'Leads'),
  ('manage_leads', 'Create and edit leads', 'Leads'),
  ('view_sessions', 'View all sessions', 'Sessions'),
  ('manage_sessions', 'Create and edit sessions', 'Sessions'),
  ('view_clients', 'View client information', 'Clients'),
  ('manage_clients', 'Manage client communications', 'Clients');

-- Create updated_at trigger for custom_roles
CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();