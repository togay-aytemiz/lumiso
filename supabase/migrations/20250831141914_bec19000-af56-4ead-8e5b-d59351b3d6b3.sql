-- Fix function search path security warnings
ALTER FUNCTION public.update_template_image_usage() SET search_path = 'public';

-- Fix other function search paths that were identified
ALTER FUNCTION public.log_lead_changes() SET search_path = 'public';
ALTER FUNCTION public.log_activity_changes() SET search_path = 'public';
ALTER FUNCTION public.log_session_changes() SET search_path = 'public';
ALTER FUNCTION public.log_lead_field_value_changes() SET search_path = 'public';