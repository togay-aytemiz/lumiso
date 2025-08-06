-- Add isSystemFinal field to lead_statuses table
ALTER TABLE public.lead_statuses 
ADD COLUMN is_system_final boolean NOT NULL DEFAULT false;

-- Create a settings table for user preferences
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  show_quick_status_buttons boolean NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS for user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for user_settings
CREATE POLICY "Users can view their own settings" 
ON public.user_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" 
ON public.user_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
ON public.user_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for updating timestamps
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to ensure system statuses exist
CREATE OR REPLACE FUNCTION public.ensure_system_lead_statuses(user_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Ensure "Completed" status exists
  INSERT INTO public.lead_statuses (user_id, name, color, is_system_final, sort_order)
  VALUES (user_uuid, 'Completed', '#22c55e', true, 1000)
  ON CONFLICT (user_id, name) DO UPDATE SET
    is_system_final = true;
  
  -- Ensure "Lost" status exists
  INSERT INTO public.lead_statuses (user_id, name, color, is_system_final, sort_order)
  VALUES (user_uuid, 'Lost', '#ef4444', true, 1001)
  ON CONFLICT (user_id, name) DO UPDATE SET
    is_system_final = true;
END;
$function$;

-- Add unique constraint to prevent duplicate status names per user
ALTER TABLE public.lead_statuses 
ADD CONSTRAINT lead_statuses_user_name_unique UNIQUE (user_id, name);

-- Update existing "Completed" and "Lost" statuses to be system final
UPDATE public.lead_statuses 
SET is_system_final = true 
WHERE LOWER(name) IN ('completed', 'lost');