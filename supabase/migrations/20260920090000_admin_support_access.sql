-- Ensure admin users can view organization-scoped data regardless of ownership
-- to support the admin users dashboard and account investigations.

-- Drop existing admin-view policies if they were created manually
DROP POLICY IF EXISTS "Admins can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "Admins can view organization settings" ON public.organization_settings;
DROP POLICY IF EXISTS "Admins can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can view projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can view sessions" ON public.sessions;
DROP POLICY IF EXISTS "Admins can view message templates" ON public.message_templates;
DROP POLICY IF EXISTS "Admins can view workflows" ON public.workflows;
DROP POLICY IF EXISTS "Admins can view services" ON public.services;
DROP POLICY IF EXISTS "Admins can view packages" ON public.packages;
DROP POLICY IF EXISTS "Admins can view session types" ON public.session_types;
DROP POLICY IF EXISTS "Admins can view payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can view lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Admins can view project statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Admins can view membership events" ON public.membership_events;

CREATE POLICY "Admins can view organizations" ON public.organizations
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view organization settings" ON public.organization_settings
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view profiles" ON public.profiles
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view leads" ON public.leads
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view projects" ON public.projects
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view sessions" ON public.sessions
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view message templates" ON public.message_templates
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view workflows" ON public.workflows
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view services" ON public.services
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view packages" ON public.packages
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view session types" ON public.session_types
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view payments" ON public.payments
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view lead statuses" ON public.lead_statuses
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view project statuses" ON public.project_statuses
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view membership events" ON public.membership_events
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
