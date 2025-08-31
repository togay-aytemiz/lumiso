-- Add phone and email columns to organization_settings for real footer data
ALTER TABLE organization_settings 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create storage tracking table for abuse prevention
CREATE TABLE IF NOT EXISTS public.template_image_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  total_images INTEGER DEFAULT 0,
  total_storage_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS for the new table
ALTER TABLE public.template_image_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for the new table
CREATE POLICY "Organization members can view storage usage" ON public.template_image_usage
FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Organization members can update storage usage" ON public.template_image_usage
FOR ALL USING (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Function to update storage usage
CREATE OR REPLACE FUNCTION public.update_template_image_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.template_image_usage (organization_id, user_id, total_images, total_storage_bytes)
    VALUES (NEW.organization_id, NEW.user_id, 1, NEW.file_size)
    ON CONFLICT (organization_id) 
    DO UPDATE SET 
      total_images = template_image_usage.total_images + 1,
      total_storage_bytes = template_image_usage.total_storage_bytes + NEW.file_size,
      updated_at = now();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.template_image_usage 
    SET 
      total_images = GREATEST(0, total_images - 1),
      total_storage_bytes = GREATEST(0, total_storage_bytes - OLD.file_size),
      updated_at = now()
    WHERE organization_id = OLD.organization_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic usage tracking
CREATE TRIGGER template_assets_usage_trigger
  AFTER INSERT OR DELETE ON public.template_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_template_image_usage();