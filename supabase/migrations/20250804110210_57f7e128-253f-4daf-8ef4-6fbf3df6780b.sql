-- Create junction table for project-service relationships
CREATE TABLE public.project_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  service_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, service_id)
);

-- Enable Row Level Security
ALTER TABLE public.project_services ENABLE ROW LEVEL SECURITY;

-- Create policies for project_services
CREATE POLICY "Users can view their own project services" 
ON public.project_services 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own project services" 
ON public.project_services 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project services" 
ON public.project_services 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project services" 
ON public.project_services 
FOR DELETE 
USING (auth.uid() = user_id);