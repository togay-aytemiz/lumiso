-- Create packages table
CREATE TABLE public.packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  duration TEXT,
  applicable_types TEXT[] DEFAULT '{}',
  default_add_ons INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own packages" 
ON public.packages 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own packages" 
ON public.packages 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own packages" 
ON public.packages 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own packages" 
ON public.packages 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_packages_updated_at
BEFORE UPDATE ON public.packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create default packages for new users
CREATE OR REPLACE FUNCTION public.ensure_default_packages(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  package_count INTEGER;
BEGIN
  -- Check if user already has packages
  SELECT COUNT(*) INTO package_count 
  FROM public.packages 
  WHERE user_id = user_uuid;
  
  -- Only create defaults if no packages exist
  IF package_count = 0 THEN
    INSERT INTO public.packages (user_id, name, description, price, duration, applicable_types, default_add_ons, is_active) VALUES
      (user_uuid, 'Wedding Standard', 'Full day wedding coverage with essentials', 15000, 'Full day', ARRAY['Wedding', 'Engagement'], 2, true),
      (user_uuid, 'Engagement Session', 'Casual outdoor or studio engagement photoshoot', 3500, '2 hours', ARRAY['Engagement'], 1, true),
      (user_uuid, 'Newborn Session', 'In-home newborn session with props and editing', 4500, '3 hours', ARRAY['Newborn', 'Family'], 1, true),
      (user_uuid, 'Baby Milestone Package', 'Capture 3, 6, 12 month milestones', 6500, 'multi-session', ARRAY['Baby', 'Family'], 2, true),
      (user_uuid, 'Family Portrait', 'Lifestyle family photography in studio or outdoor', 3000, '1 hour', ARRAY['Family', 'Portrait'], 1, true),
      (user_uuid, 'Event Coverage Standard', 'Full coverage for corporate or private events', 7500, '6 hours', ARRAY['Corporate', 'Event'], 2, true);
  END IF;
END;
$$;

-- Update the new user trigger to include packages
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Create organization member record for new user as Owner
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.id, 'Owner');
  
  -- Create default working hours (Monday to Friday enabled, 9 AM to 5 PM)
  INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
  VALUES 
    (NEW.id, 1, true, '09:00', '17:00'), -- Monday
    (NEW.id, 2, true, '09:00', '17:00'), -- Tuesday
    (NEW.id, 3, true, '09:00', '17:00'), -- Wednesday
    (NEW.id, 4, true, '09:00', '17:00'), -- Thursday
    (NEW.id, 5, true, '09:00', '17:00'), -- Friday
    (NEW.id, 6, false, '09:00', '17:00'), -- Saturday
    (NEW.id, 0, false, '09:00', '17:00'); -- Sunday

  -- Create default packages
  PERFORM public.ensure_default_packages(NEW.id);
  
  RETURN NEW;
END;
$$;