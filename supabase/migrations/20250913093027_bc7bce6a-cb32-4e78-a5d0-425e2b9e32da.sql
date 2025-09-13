-- Complete team management removal migration
-- Remove assignees columns from leads and projects
ALTER TABLE public.leads DROP COLUMN IF EXISTS assignees;
ALTER TABLE public.projects DROP COLUMN IF EXISTS assignees;

-- Drop team-related tables
DROP TABLE IF EXISTS public.organization_members CASCADE;
DROP TABLE IF EXISTS public.invitations CASCADE;
DROP TABLE IF EXISTS public.invitation_audit_log CASCADE;
DROP TABLE IF EXISTS public.custom_roles CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.permissions CASCADE;

-- Update RLS policies to be owner-only
-- Remove references to organization_members in existing policies and update to owner-only

-- Update user_settings to remove active_organization_id (single user per org now)
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS active_organization_id;

-- Update organization structure to be single-user only
-- Organizations table already has owner_id, so it's ready for single-user mode

-- Update get_user_active_organization_id function to return user's owned organization
CREATE OR REPLACE FUNCTION public.get_user_active_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- Return the organization owned by the current user
  SELECT id FROM public.organizations WHERE owner_id = auth.uid() LIMIT 1;
$$;

-- Create simplified user_has_permission function that always returns true for owners
CREATE OR REPLACE FUNCTION public.user_has_permission(user_uuid uuid, permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- In single-user mode, organization owners have all permissions
  SELECT EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE owner_id = user_uuid
  );
$$;

-- Update RLS policies for leads table to be owner-only
DROP POLICY IF EXISTS "Users can update assigned leads with edit permission" ON public.leads;
DROP POLICY IF EXISTS "Users can view assigned leads with permission" ON public.leads;
DROP POLICY IF EXISTS "Users with create_leads can create leads" ON public.leads;
DROP POLICY IF EXISTS "Users with delete_leads can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Users with manage_all_leads can update all leads" ON public.leads;
DROP POLICY IF EXISTS "Users with manage_all_leads can view all leads" ON public.leads;

-- Create simple owner-only policies for leads
CREATE POLICY "Organization owners can manage leads" ON public.leads
FOR ALL USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
) WITH CHECK (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
);

-- Update RLS policies for projects table to be owner-only
DROP POLICY IF EXISTS "Users can view assigned projects with permission" ON public.projects;
DROP POLICY IF EXISTS "Users can update assigned projects with edit permission" ON public.projects;
DROP POLICY IF EXISTS "Users with manage_all_projects can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Users with manage_all_projects can update all projects" ON public.projects;
DROP POLICY IF EXISTS "Users with create_projects can create projects" ON public.projects;
DROP POLICY IF EXISTS "Users with delete_projects can delete projects" ON public.projects;

-- Create simple owner-only policies for projects
CREATE POLICY "Organization owners can manage projects" ON public.projects
FOR ALL USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
) WITH CHECK (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
);

-- Update other tables' RLS policies to use simplified organization check
-- Services table
DROP POLICY IF EXISTS "Users with manage_services can create services" ON public.services;
DROP POLICY IF EXISTS "Users with manage_services can delete services" ON public.services;
DROP POLICY IF EXISTS "Users with manage_services can update services" ON public.services;
DROP POLICY IF EXISTS "Users with view_services can view services" ON public.services;

CREATE POLICY "Organization owners can manage services" ON public.services
FOR ALL USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
) WITH CHECK (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
);

-- Packages table
DROP POLICY IF EXISTS "Users with manage_packages can create packages" ON public.packages;
DROP POLICY IF EXISTS "Users with manage_packages can delete packages" ON public.packages;
DROP POLICY IF EXISTS "Users with manage_packages can update packages" ON public.packages;
DROP POLICY IF EXISTS "Users with view_packages can view packages" ON public.packages;

CREATE POLICY "Organization owners can manage packages" ON public.packages
FOR ALL USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
) WITH CHECK (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
);

-- Organization settings table
DROP POLICY IF EXISTS "Organization owners and members can view organization settings" ON public.organization_settings;
DROP POLICY IF EXISTS "Users with manage_organization_settings can create settings" ON public.organization_settings;
DROP POLICY IF EXISTS "Users with manage_organization_settings can update settings" ON public.organization_settings;
DROP POLICY IF EXISTS "Users with view_organization_settings can view settings" ON public.organization_settings;

CREATE POLICY "Organization owners can manage settings" ON public.organization_settings
FOR ALL USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
) WITH CHECK (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
);

-- Update project and lead statuses tables
DROP POLICY IF EXISTS "Organization owners and members can view project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Users with manage_project_statuses can create project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Users with manage_project_statuses can delete project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Users with manage_project_statuses can update project statuses" ON public.project_statuses;

CREATE POLICY "Organization owners can manage project statuses" ON public.project_statuses
FOR ALL USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
) WITH CHECK (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
);

-- Clean up notification system tables that referenced team members
DELETE FROM public.notifications WHERE notification_type IN ('new-assignment', 'project-milestone');

-- Remove workflow functions that referenced team members
DROP FUNCTION IF EXISTS public.user_is_organization_member(uuid);
DROP FUNCTION IF EXISTS public.user_is_assigned_to_project(uuid, uuid);  
DROP FUNCTION IF EXISTS public.user_is_assigned_to_lead(uuid, uuid);
DROP FUNCTION IF EXISTS public.user_can_access_project(uuid, uuid);

-- Create simplified access functions
CREATE OR REPLACE FUNCTION public.user_can_access_project(user_uuid uuid, project_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- In single-user mode, only check if user owns the organization
  SELECT EXISTS (
    SELECT 1 FROM projects p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = project_uuid 
    AND o.owner_id = user_uuid
  );
$$;