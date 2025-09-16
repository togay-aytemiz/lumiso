-- Add admin role to togayaytemiz@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u 
WHERE u.email = 'togayaytemiz@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;