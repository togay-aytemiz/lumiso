-- Create project_types table
CREATE TABLE public.project_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable Row Level Security
ALTER TABLE public.project_types ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own project types" 
ON public.project_types 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own project types" 
ON public.project_types 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project types" 
ON public.project_types 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project types" 
ON public.project_types 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_project_types_updated_at
BEFORE UPDATE ON public.project_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to ensure only one default per user
CREATE OR REPLACE FUNCTION public.ensure_single_default_project_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Set all other types for this user to non-default
    UPDATE public.project_types 
    SET is_default = false 
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  
  -- If this was the only default and we're setting it to false, prevent it
  IF OLD.is_default = true AND NEW.is_default = false THEN
    -- Check if there are other defaults
    IF NOT EXISTS (
      SELECT 1 FROM public.project_types 
      WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = true
    ) THEN
      RAISE EXCEPTION 'There must always be one default project type';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;