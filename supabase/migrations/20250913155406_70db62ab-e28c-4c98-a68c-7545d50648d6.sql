-- Add RLS policies for tables that are missing them (from security warnings)

-- Project statuses
ALTER TABLE public.project_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization owners can manage project statuses" ON public.project_statuses
  FOR ALL USING (organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()));

-- Session statuses  
ALTER TABLE public.session_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization owners can manage session statuses" ON public.session_statuses
  FOR ALL USING (organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()));

-- Project types
ALTER TABLE public.project_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization owners can manage project types" ON public.project_types
  FOR ALL USING (organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()));

-- Lead statuses
ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization owners can manage lead statuses" ON public.lead_statuses
  FOR ALL USING (organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()));

-- Sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization owners can manage sessions" ON public.sessions
  FOR ALL USING (organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()));

-- Payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization owners can manage payments" ON public.payments
  FOR ALL USING (organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()));

-- Workflows  
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization owners can manage workflows" ON public.workflows
  FOR ALL USING (organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()));