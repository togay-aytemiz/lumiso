-- Create project_statuses table
CREATE TABLE public.project_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable Row Level Security
ALTER TABLE public.project_statuses ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own project statuses" 
ON public.project_statuses 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own project statuses" 
ON public.project_statuses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project statuses" 
ON public.project_statuses 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project statuses" 
ON public.project_statuses 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_project_statuses_updated_at
BEFORE UPDATE ON public.project_statuses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default project statuses for all existing users
INSERT INTO public.project_statuses (user_id, name, color)
SELECT 
  auth.users.id,
  status.name,
  status.color
FROM auth.users
CROSS JOIN (
  VALUES 
    ('Planned', '#A0AEC0'),
    ('Booked', '#ECC94B'),
    ('Editing', '#9F7AEA'),
    ('Ready to Deliver', '#63B3ED'),
    ('Completed', '#48BB78'),
    ('Cancelled', '#F56565')
) AS status(name, color)
WHERE auth.users.id IS NOT NULL
ON CONFLICT (user_id, name) DO NOTHING;