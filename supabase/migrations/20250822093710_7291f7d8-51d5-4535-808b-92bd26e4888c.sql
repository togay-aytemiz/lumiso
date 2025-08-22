-- Create lead field definitions table
CREATE TABLE public.lead_field_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'textarea', 'email', 'phone', 'date', 'select', 'checkbox', 'number')),
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_visible_in_form BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 1,
  options JSONB,
  validation_rules JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_org_field_key UNIQUE(organization_id, field_key)
);

-- Create lead field values table
CREATE TABLE public.lead_field_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_lead_field_key UNIQUE(lead_id, field_key)
);

-- Enable RLS on both tables
ALTER TABLE public.lead_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_field_values ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_lead_field_definitions_org_id ON public.lead_field_definitions(organization_id);
CREATE INDEX idx_lead_field_definitions_sort_order ON public.lead_field_definitions(organization_id, sort_order);
CREATE INDEX idx_lead_field_values_lead_id ON public.lead_field_values(lead_id);
CREATE INDEX idx_lead_field_values_field_key ON public.lead_field_values(lead_id, field_key);

-- RLS Policies for lead_field_definitions
CREATE POLICY "Organization members can view lead field definitions"
ON public.lead_field_definitions FOR SELECT
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can create lead field definitions"
ON public.lead_field_definitions FOR INSERT
WITH CHECK (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can update lead field definitions"
ON public.lead_field_definitions FOR UPDATE
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can delete custom lead field definitions"
ON public.lead_field_definitions FOR DELETE
USING (organization_id = get_user_active_organization_id() AND is_system = false);

-- RLS Policies for lead_field_values
CREATE POLICY "Organization members can view lead field values"
ON public.lead_field_values FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.leads l 
    WHERE l.id = lead_field_values.lead_id 
    AND l.organization_id = get_user_active_organization_id()
  )
);

CREATE POLICY "Organization members can create lead field values"
ON public.lead_field_values FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads l 
    WHERE l.id = lead_field_values.lead_id 
    AND l.organization_id = get_user_active_organization_id()
  )
);

CREATE POLICY "Organization members can update lead field values"
ON public.lead_field_values FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.leads l 
    WHERE l.id = lead_field_values.lead_id 
    AND l.organization_id = get_user_active_organization_id()
  )
);

CREATE POLICY "Organization members can delete lead field values"
ON public.lead_field_values FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.leads l 
    WHERE l.id = lead_field_values.lead_id 
    AND l.organization_id = get_user_active_organization_id()
  )
);

-- Function to ensure default lead field definitions for an organization
CREATE OR REPLACE FUNCTION public.ensure_default_lead_field_definitions(org_id UUID, user_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  field_count INTEGER;
BEGIN
  -- Check if organization already has field definitions
  SELECT COUNT(*) INTO field_count 
  FROM public.lead_field_definitions 
  WHERE organization_id = org_id;
  
  -- Only create defaults if no field definitions exist
  IF field_count = 0 THEN
    INSERT INTO public.lead_field_definitions (
      organization_id, field_key, label, field_type, is_system, is_required, is_visible_in_form, sort_order
    ) VALUES
      (org_id, 'name', 'Full Name', 'text', true, true, true, 1),
      (org_id, 'email', 'Email Address', 'email', true, false, true, 2),
      (org_id, 'phone', 'Phone Number', 'phone', true, false, true, 3),
      (org_id, 'notes', 'Notes', 'textarea', true, false, false, 4);
  END IF;
END;
$$;

-- Function to migrate existing lead data to field values
CREATE OR REPLACE FUNCTION public.migrate_existing_lead_data(org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Migrate existing lead data to field values table
  INSERT INTO public.lead_field_values (lead_id, field_key, value)
  SELECT 
    l.id,
    'name',
    l.name
  FROM public.leads l
  WHERE l.organization_id = org_id
    AND l.name IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_field_values lfv 
      WHERE lfv.lead_id = l.id AND lfv.field_key = 'name'
    );

  INSERT INTO public.lead_field_values (lead_id, field_key, value)
  SELECT 
    l.id,
    'email',
    l.email
  FROM public.leads l
  WHERE l.organization_id = org_id
    AND l.email IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_field_values lfv 
      WHERE lfv.lead_id = l.id AND lfv.field_key = 'email'
    );

  INSERT INTO public.lead_field_values (lead_id, field_key, value)
  SELECT 
    l.id,
    'phone',
    l.phone
  FROM public.leads l
  WHERE l.organization_id = org_id
    AND l.phone IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_field_values lfv 
      WHERE lfv.lead_id = l.id AND lfv.field_key = 'phone'
    );

  INSERT INTO public.lead_field_values (lead_id, field_key, value)
  SELECT 
    l.id,
    'notes',
    l.notes
  FROM public.leads l
  WHERE l.organization_id = org_id
    AND l.notes IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_field_values lfv 
      WHERE lfv.lead_id = l.id AND lfv.field_key = 'notes'
    );
END;
$$;

-- Function to initialize field definitions for existing organizations
CREATE OR REPLACE FUNCTION public.initialize_all_organization_field_definitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN 
    SELECT id, owner_id FROM public.organizations
  LOOP
    PERFORM public.ensure_default_lead_field_definitions(org_record.id, org_record.owner_id);
    PERFORM public.migrate_existing_lead_data(org_record.id);
  END LOOP;
END;
$$;

-- Triggers for updated_at columns
CREATE TRIGGER update_lead_field_definitions_updated_at
  BEFORE UPDATE ON public.lead_field_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lead_field_values_updated_at
  BEFORE UPDATE ON public.lead_field_values
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Initialize field definitions for all existing organizations
SELECT public.initialize_all_organization_field_definitions();