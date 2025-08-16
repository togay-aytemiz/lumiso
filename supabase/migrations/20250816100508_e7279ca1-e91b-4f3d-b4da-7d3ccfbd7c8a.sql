-- Extend user_settings table for general settings
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS photography_business_name TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS primary_brand_color TEXT DEFAULT '#1EB29F';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'DD/MM/YYYY';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS time_format TEXT DEFAULT '12-hour';

-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for logo uploads
CREATE POLICY "Users can view their own logos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own logos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own logos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to ensure user settings exist
CREATE OR REPLACE FUNCTION public.ensure_user_settings(user_uuid uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  settings_id uuid;
BEGIN
  -- Try to get existing settings
  SELECT id INTO settings_id
  FROM public.user_settings
  WHERE user_id = user_uuid;
  
  -- Create default settings if they don't exist
  IF settings_id IS NULL THEN
    INSERT INTO public.user_settings (
      user_id, 
      show_quick_status_buttons,
      photography_business_name,
      logo_url,
      primary_brand_color,
      date_format,
      time_format
    ) VALUES (
      user_uuid,
      true,
      '',
      null,
      '#1EB29F',
      'DD/MM/YYYY',
      '12-hour'
    ) RETURNING id INTO settings_id;
  END IF;
  
  RETURN settings_id;
END;
$$;