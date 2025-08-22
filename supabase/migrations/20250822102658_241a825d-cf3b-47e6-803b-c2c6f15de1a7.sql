-- Add is_visible_in_table column to lead_field_definitions
ALTER TABLE public.lead_field_definitions 
ADD COLUMN is_visible_in_table boolean NOT NULL DEFAULT false;

-- Update existing system fields to be visible in table by default
UPDATE public.lead_field_definitions 
SET is_visible_in_table = true 
WHERE field_key IN ('name', 'email', 'phone') AND is_system = true;

-- Create user_column_preferences table for storing table customization
CREATE TABLE public.user_column_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  table_name text NOT NULL,
  column_config jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, table_name)
);

-- Enable RLS on user_column_preferences
ALTER TABLE public.user_column_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_column_preferences
CREATE POLICY "Users can view their own column preferences" 
ON public.user_column_preferences 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own column preferences" 
ON public.user_column_preferences 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own column preferences" 
ON public.user_column_preferences 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own column preferences" 
ON public.user_column_preferences 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create updated_at trigger for user_column_preferences
CREATE TRIGGER update_user_column_preferences_updated_at
  BEFORE UPDATE ON public.user_column_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();