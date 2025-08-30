-- Phase 1: Schema Enhancement for Template Builder

-- Create email_templates table for block-based templates
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  preheader TEXT,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  category TEXT DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE,
  last_saved_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create template_assets table for uploaded images
CREATE TABLE public.template_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  content_type TEXT,
  alt_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create storage bucket for template images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'template-images', 
  'template-images', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- Create indexes for better performance
CREATE INDEX idx_email_templates_organization_id ON public.email_templates(organization_id);
CREATE INDEX idx_email_templates_status ON public.email_templates(status);
CREATE INDEX idx_email_templates_updated_at ON public.email_templates(updated_at DESC);
CREATE INDEX idx_template_assets_template_id ON public.template_assets(template_id);
CREATE INDEX idx_template_assets_organization_id ON public.template_assets(organization_id);

-- Create updated_at trigger function for email_templates
CREATE OR REPLACE FUNCTION public.update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_templates_updated_at();

-- RLS Policies for email_templates
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view email templates"
  ON public.email_templates FOR SELECT
  USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can create email templates"
  ON public.email_templates FOR INSERT
  WITH CHECK (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can update email templates"
  ON public.email_templates FOR UPDATE
  USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can delete email templates"
  ON public.email_templates FOR DELETE
  USING (organization_id = get_user_active_organization_id());

-- RLS Policies for template_assets
ALTER TABLE public.template_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view template assets"
  ON public.template_assets FOR SELECT
  USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can create template assets"
  ON public.template_assets FOR INSERT
  WITH CHECK (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can update template assets"
  ON public.template_assets FOR UPDATE
  USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can delete template assets"
  ON public.template_assets FOR DELETE
  USING (organization_id = get_user_active_organization_id());

-- Storage policies for template-images bucket
CREATE POLICY "Organization members can view template images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'template-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Organization members can upload template images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'template-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Organization members can update template images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'template-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Organization members can delete template images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'template-images' AND auth.uid()::text = (storage.foldername(name))[1]);