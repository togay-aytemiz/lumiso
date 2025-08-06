-- Create lead_statuses table
CREATE TABLE public.lead_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own lead statuses" 
ON public.lead_statuses 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own lead statuses" 
ON public.lead_statuses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lead statuses" 
ON public.lead_statuses 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lead statuses" 
ON public.lead_statuses 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add status_id column to leads table
ALTER TABLE public.leads ADD COLUMN status_id UUID;

-- Create function to get default lead status
CREATE OR REPLACE FUNCTION public.get_default_lead_status(user_uuid uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  default_status_id UUID;
BEGIN
  -- First try to find "new" status
  SELECT id INTO default_status_id 
  FROM public.lead_statuses 
  WHERE user_id = user_uuid AND LOWER(name) = 'new'
  LIMIT 1;
  
  -- If "new" doesn't exist, get the first available status
  IF default_status_id IS NULL THEN
    SELECT id INTO default_status_id 
    FROM public.lead_statuses 
    WHERE user_id = user_uuid 
    ORDER BY created_at ASC 
    LIMIT 1;
  END IF;
  
  RETURN default_status_id;
END;
$function$;