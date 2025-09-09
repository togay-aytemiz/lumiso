-- Ensure template system consistency and data integrity
-- This migration ensures all templates have proper referential integrity

-- First, let's ensure all message_templates have at least one channel view
-- Create default email channel views for templates that don't have any
INSERT INTO public.template_channel_views (template_id, channel, subject, content)
SELECT 
  mt.id,
  'email',
  COALESCE(mt.master_subject, mt.name, 'Subject'),
  COALESCE(mt.master_content, '')
FROM public.message_templates mt
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.template_channel_views tcv 
  WHERE tcv.template_id = mt.id
)
AND mt.is_active = true;

-- Add indexes for better performance on template operations
CREATE INDEX IF NOT EXISTS idx_message_templates_org_active 
ON public.message_templates(organization_id, is_active);

CREATE INDEX IF NOT EXISTS idx_template_channel_views_template_channel 
ON public.template_channel_views(template_id, channel);

-- Add a trigger to ensure templates always have at least an email channel view
CREATE OR REPLACE FUNCTION public.ensure_default_email_channel()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create default email channel for active templates
  IF NEW.is_active = true THEN
    -- Check if there's already an email channel view
    IF NOT EXISTS (
      SELECT 1 FROM public.template_channel_views 
      WHERE template_id = NEW.id AND channel = 'email'
    ) THEN
      -- Create default email channel view
      INSERT INTO public.template_channel_views (template_id, channel, subject, content)
      VALUES (
        NEW.id, 
        'email',
        COALESCE(NEW.master_subject, NEW.name, 'Subject'),
        COALESCE(NEW.master_content, '')
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run after template insert or update
DROP TRIGGER IF EXISTS ensure_email_channel_trigger ON public.message_templates;
CREATE TRIGGER ensure_email_channel_trigger
  AFTER INSERT OR UPDATE ON public.message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_default_email_channel();

-- Add a function to clean up orphaned channel views
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_channel_views()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.template_channel_views
  WHERE template_id NOT IN (
    SELECT id FROM public.message_templates
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the cleanup function once to remove any existing orphaned records
SELECT public.cleanup_orphaned_channel_views();