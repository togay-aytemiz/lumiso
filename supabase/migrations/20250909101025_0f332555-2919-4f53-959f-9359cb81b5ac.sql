-- Add blocks column to message_templates table to store JSON representation of template blocks
ALTER TABLE public.message_templates 
ADD COLUMN blocks JSONB DEFAULT '[]'::jsonb;