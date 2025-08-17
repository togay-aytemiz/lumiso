-- Update packages table to store service IDs instead of just count
ALTER TABLE public.packages 
DROP COLUMN default_add_ons,
ADD COLUMN default_add_ons TEXT[] DEFAULT '{}';

-- Update the default packages function to not include any add-ons
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
      (user_uuid, 'Wedding Standard', 'Full day wedding coverage with essentials', 15000, 'Full day', ARRAY['Wedding', 'Engagement'], ARRAY[]::TEXT[], true),
      (user_uuid, 'Engagement Session', 'Casual outdoor or studio engagement photoshoot', 3500, '2 hours', ARRAY['Engagement'], ARRAY[]::TEXT[], true),
      (user_uuid, 'Newborn Session', 'In-home newborn session with props and editing', 4500, '3 hours', ARRAY['Newborn', 'Family'], ARRAY[]::TEXT[], true),
      (user_uuid, 'Baby Milestone Package', 'Capture 3, 6, 12 month milestones', 6500, 'multi-session', ARRAY['Baby', 'Family'], ARRAY[]::TEXT[], true),
      (user_uuid, 'Family Portrait', 'Lifestyle family photography in studio or outdoor', 3000, '1 hour', ARRAY['Family', 'Portrait'], ARRAY[]::TEXT[], true),
      (user_uuid, 'Event Coverage Standard', 'Full coverage for corporate or private events', 7500, '6 hours', ARRAY['Corporate', 'Event'], ARRAY[]::TEXT[], true);
  END IF;
END;
$$;