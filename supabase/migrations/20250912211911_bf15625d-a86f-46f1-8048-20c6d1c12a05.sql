-- Fix permissions system comprehensively

-- 1. Update user_has_permission to honor system roles from role_templates  
CREATE OR REPLACE FUNCTION public.user_has_permission(user_uuid uuid, permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Check if user has permission through custom role
  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    JOIN custom_roles cr ON om.custom_role_id = cr.id
    JOIN role_permissions rp ON cr.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE om.user_id = user_uuid 
    AND om.status = 'active'
    AND om.organization_id = get_user_active_organization_id()
    AND p.name = permission_name
  ) OR EXISTS (
    -- Check system roles (Owner has all permissions)
    SELECT 1 FROM organization_members om
    WHERE om.user_id = user_uuid 
    AND om.status = 'active'
    AND om.organization_id = get_user_active_organization_id()
    AND om.system_role = 'Owner'
  ) OR EXISTS (
    -- Check system role permissions from role_templates
    SELECT 1 FROM organization_members om
    JOIN role_templates rt ON rt.name = om.role
    WHERE om.user_id = user_uuid 
    AND om.status = 'active'
    AND om.organization_id = get_user_active_organization_id()
    AND permission_name = ANY(rt.permissions)
  );
$function$;

-- 2. Add RLS policies for organization_settings to enforce permissions
DROP POLICY IF EXISTS "Organization owners and members can update organization setting" ON public.organization_settings;
DROP POLICY IF EXISTS "Organization owners and members can create organization setting" ON public.organization_settings;

-- Only allow viewing org settings if user has permission
CREATE POLICY "Users with view_organization_settings can view settings" 
ON public.organization_settings FOR SELECT
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'view_organization_settings') OR
    user_has_permission(auth.uid(), 'manage_organization_settings') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = organization_settings.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

-- Only allow updating org settings if user has manage permission
CREATE POLICY "Users with manage_organization_settings can update settings" 
ON public.organization_settings FOR UPDATE
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'manage_organization_settings') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = organization_settings.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

-- Only allow creating org settings if user has manage permission  
CREATE POLICY "Users with manage_organization_settings can create settings" 
ON public.organization_settings FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'manage_organization_settings') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = organization_settings.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

-- 3. Update services RLS policies to check proper permissions
DROP POLICY IF EXISTS "Organization owners and members can view services" ON public.services;
DROP POLICY IF EXISTS "Organization owners and members can update services" ON public.services;
DROP POLICY IF EXISTS "Organization owners and members can create services" ON public.services;
DROP POLICY IF EXISTS "Organization owners and members can delete services" ON public.services;

CREATE POLICY "Users with view_services can view services" 
ON public.services FOR SELECT
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'view_services') OR
    user_has_permission(auth.uid(), 'manage_services') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = services.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users with manage_services can update services" 
ON public.services FOR UPDATE
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'manage_services') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = services.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users with manage_services can create services" 
ON public.services FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'manage_services') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = services.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users with manage_services can delete services" 
ON public.services FOR DELETE
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'manage_services') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = services.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

-- 4. Update packages RLS policies to check proper permissions
DROP POLICY IF EXISTS "Organization owners and members can view packages" ON public.packages;
DROP POLICY IF EXISTS "Organization owners and members can update packages" ON public.packages;
DROP POLICY IF EXISTS "Organization owners and members can create packages" ON public.packages;
DROP POLICY IF EXISTS "Organization owners and members can delete packages" ON public.packages;

CREATE POLICY "Users with view_packages can view packages" 
ON public.packages FOR SELECT
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'view_packages') OR
    user_has_permission(auth.uid(), 'manage_packages') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = packages.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users with manage_packages can update packages" 
ON public.packages FOR UPDATE
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'manage_packages') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = packages.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users with manage_packages can create packages" 
ON public.packages FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'manage_packages') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = packages.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users with manage_packages can delete packages" 
ON public.packages FOR DELETE
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'manage_packages') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = packages.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

-- 5. Update workflows RLS policies for automation permissions
DROP POLICY IF EXISTS "Organization members can view workflows" ON public.workflows;
DROP POLICY IF EXISTS "Organization members can update workflows" ON public.workflows;
DROP POLICY IF EXISTS "Organization members can create workflows" ON public.workflows;
DROP POLICY IF EXISTS "Organization members can delete workflows" ON public.workflows;

CREATE POLICY "Users with view_workflows can view workflows" 
ON public.workflows FOR SELECT
USING (
  organization_id = get_user_active_organization_id() AND (
    user_has_permission(auth.uid(), 'view_workflows') OR
    user_has_permission(auth.uid(), 'manage_workflows') OR
    user_has_permission(auth.uid(), 'create_workflows') OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = workflows.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users with manage_workflows can update workflows" 
ON public.workflows FOR UPDATE
USING (
  organization_id = get_user_active_organization_id() AND (
    user_has_permission(auth.uid(), 'manage_workflows') OR
    user_has_permission(auth.uid(), 'edit_workflows') OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = workflows.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users with create_workflows can create workflows" 
ON public.workflows FOR INSERT
WITH CHECK (
  organization_id = get_user_active_organization_id() AND (
    user_has_permission(auth.uid(), 'create_workflows') OR
    user_has_permission(auth.uid(), 'manage_workflows') OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = workflows.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users with delete_workflows can delete workflows" 
ON public.workflows FOR DELETE
USING (
  organization_id = get_user_active_organization_id() AND (
    user_has_permission(auth.uid(), 'delete_workflows') OR
    user_has_permission(auth.uid(), 'manage_workflows') OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = workflows.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
    )
  )
);

-- 6. Update payments table RLS for financial permissions
DROP POLICY IF EXISTS "Organization members can view payments" ON public.payments;
DROP POLICY IF EXISTS "Organization members can update payments" ON public.payments;
DROP POLICY IF EXISTS "Organization members can create payments" ON public.payments;
DROP POLICY IF EXISTS "Organization members can delete payments" ON public.payments;

CREATE POLICY "Users with view_financial_data can view payments" 
ON public.payments FOR SELECT
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'view_financial_data') OR
    user_has_permission(auth.uid(), 'manage_payments') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = payments.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users with manage_payments can update payments" 
ON public.payments FOR UPDATE
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'manage_payments') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = payments.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users with manage_payments can create payments" 
ON public.payments FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'manage_payments') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = payments.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users with manage_payments can delete payments" 
ON public.payments FOR DELETE
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND (
    user_has_permission(auth.uid(), 'manage_payments') OR
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = payments.organization_id 
      AND om2.user_id = auth.uid() 
      AND om2.system_role = 'Owner'
    )
  )
);

-- 7. Update project/lead status tables to require manage permissions
DROP POLICY IF EXISTS "Organization owners and members can update project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Organization owners and members can create project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Organization owners and members can delete project statuses" ON public.project_statuses;

CREATE POLICY "Users with manage_project_statuses can update project statuses" 
ON public.project_statuses FOR UPDATE
USING (
  organization_id = get_user_active_organization_id() AND (
    user_has_permission(auth.uid(), 'manage_project_statuses') OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = project_statuses.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users with manage_project_statuses can create project statuses" 
ON public.project_statuses FOR INSERT
WITH CHECK (
  organization_id = get_user_active_organization_id() AND (
    user_has_permission(auth.uid(), 'manage_project_statuses') OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = project_statuses.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
    )
  )
);

CREATE POLICY "Users with manage_project_statuses can delete project statuses" 
ON public.project_statuses FOR DELETE
USING (
  organization_id = get_user_active_organization_id() AND (
    user_has_permission(auth.uid(), 'manage_project_statuses') OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = project_statuses.organization_id 
      AND om.user_id = auth.uid() 
      AND om.system_role = 'Owner'
    )
  )
);