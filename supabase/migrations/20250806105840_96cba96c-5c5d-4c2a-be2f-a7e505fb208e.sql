-- Update the ensure_system_lead_statuses function to use the correct names and colors
CREATE OR REPLACE FUNCTION public.ensure_system_lead_statuses(user_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Ensure "Completed" status exists with green color
  INSERT INTO public.lead_statuses (user_id, name, color, is_system_final, sort_order)
  VALUES (user_uuid, 'Completed', '#22c55e', true, 1000)
  ON CONFLICT (user_id, name) DO UPDATE SET
    is_system_final = true,
    color = '#22c55e';
  
  -- Ensure "Lost" status exists with red color
  INSERT INTO public.lead_statuses (user_id, name, color, is_system_final, sort_order)
  VALUES (user_uuid, 'Lost', '#ef4444', true, 1001)
  ON CONFLICT (user_id, name) DO UPDATE SET
    is_system_final = true,
    color = '#ef4444';
END;
$function$