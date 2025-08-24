-- Add master subject field to message templates for inheritance
ALTER TABLE public.message_templates 
ADD COLUMN master_subject TEXT;

-- Add comment explaining the inheritance concept
COMMENT ON COLUMN public.message_templates.master_subject IS 'Default subject line that channel-specific subjects can inherit from';