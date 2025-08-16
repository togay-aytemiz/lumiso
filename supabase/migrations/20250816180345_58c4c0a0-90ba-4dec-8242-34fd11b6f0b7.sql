-- Create missing organization member record for current user
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT id, id, 'Owner'
FROM auth.users 
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_members 
  WHERE organization_id = auth.users.id AND user_id = auth.users.id
);

-- Create missing working hours for current user (weekdays enabled by default)
INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
SELECT u.id, day_info.day_of_week, day_info.enabled, day_info.start_time::time, day_info.end_time::time
FROM auth.users u
CROSS JOIN (
  VALUES 
    (1, true, '09:00', '17:00'), -- Monday
    (2, true, '09:00', '17:00'), -- Tuesday
    (3, true, '09:00', '17:00'), -- Wednesday
    (4, true, '09:00', '17:00'), -- Thursday
    (5, true, '09:00', '17:00'), -- Friday
    (6, false, '09:00', '17:00'), -- Saturday
    (0, false, '09:00', '17:00')  -- Sunday
) AS day_info(day_of_week, enabled, start_time, end_time)
WHERE NOT EXISTS (
  SELECT 1 FROM public.working_hours 
  WHERE user_id = u.id AND day_of_week = day_info.day_of_week
);