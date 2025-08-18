-- Fix remaining data visibility issues for team members

-- 1. Add organization_id to payments table and update policies
ALTER TABLE public.payments ADD COLUMN organization_id UUID;

-- Update existing payments to have organization_id from their associated project
UPDATE public.payments 
SET organization_id = (
  SELECT p.organization_id 
  FROM public.projects p 
  WHERE p.id = payments.project_id
);

-- Make organization_id NOT NULL for future payments
-- Note: We'll handle NULL values in the application by requiring organization_id

-- Update payments RLS policies to be organization-based
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can create their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can update their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can delete their own payments" ON public.payments;

CREATE POLICY "Organization members can view payments" ON public.payments FOR SELECT 
USING (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can create payments" ON public.payments FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can update payments" ON public.payments FOR UPDATE 
USING (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can delete payments" ON public.payments FOR DELETE 
USING (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

-- 2. Simplify activities RLS to be directly organization-based
-- Add organization_id to activities table
ALTER TABLE public.activities ADD COLUMN organization_id UUID;

-- Update existing activities to have organization_id
UPDATE public.activities 
SET organization_id = (
  SELECT l.organization_id 
  FROM public.leads l 
  WHERE l.id = activities.lead_id
)
WHERE lead_id IS NOT NULL;

UPDATE public.activities 
SET organization_id = (
  SELECT p.organization_id 
  FROM public.projects p 
  WHERE p.id = activities.project_id
)
WHERE project_id IS NOT NULL AND organization_id IS NULL;

-- Update activities RLS policies to be simpler organization-based
DROP POLICY IF EXISTS "Organization members can view activities" ON public.activities;
DROP POLICY IF EXISTS "Organization members can create activities" ON public.activities;
DROP POLICY IF EXISTS "Organization members can update activities" ON public.activities;
DROP POLICY IF EXISTS "Organization members can delete activities" ON public.activities;

CREATE POLICY "Organization members can view activities" ON public.activities FOR SELECT 
USING (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can create activities" ON public.activities FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can update activities" ON public.activities FOR UPDATE 
USING (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can delete activities" ON public.activities FOR DELETE 
USING (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

-- 3. Split user_settings into personal and organization settings
-- Create organization_settings table for shared settings
CREATE TABLE public.organization_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  photography_business_name TEXT,
  logo_url TEXT,
  primary_brand_color TEXT DEFAULT '#1EB29F',
  date_format TEXT DEFAULT 'DD/MM/YYYY',
  time_format TEXT DEFAULT '12-hour'
);

-- Enable RLS on organization_settings
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for organization_settings
CREATE POLICY "Organization members can view organization settings" ON public.organization_settings FOR SELECT 
USING (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can create organization settings" ON public.organization_settings FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

CREATE POLICY "Organization members can update organization settings" ON public.organization_settings FOR UPDATE 
USING (organization_id IN (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = auth.uid() AND om.status = 'active'
));

-- Migrate existing organization settings from user_settings to organization_settings
INSERT INTO public.organization_settings (
  organization_id, 
  photography_business_name, 
  logo_url, 
  primary_brand_color, 
  date_format, 
  time_format
)
SELECT DISTINCT
  us.active_organization_id,
  us.photography_business_name,
  us.logo_url,
  us.primary_brand_color,
  us.date_format,
  us.time_format
FROM public.user_settings us
WHERE us.active_organization_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Create trigger for automatic timestamp updates on organization_settings
CREATE TRIGGER update_organization_settings_updated_at
BEFORE UPDATE ON public.organization_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();