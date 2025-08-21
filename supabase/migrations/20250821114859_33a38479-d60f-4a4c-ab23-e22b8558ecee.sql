-- Ensure user_settings exists for current user
INSERT INTO public.user_settings (
  user_id, 
  show_quick_status_buttons,
  photography_business_name,
  primary_brand_color,
  date_format,
  time_format,
  notification_global_enabled,
  notification_daily_summary_enabled,
  notification_weekly_recap_enabled,
  notification_new_assignment_enabled,
  notification_project_milestone_enabled,
  notification_scheduled_time,
  in_guided_setup,
  guided_setup_skipped,
  guidance_completed,
  current_step,
  completed_steps
) 
SELECT 
  auth.uid(),
  true,
  '',
  '#1EB29F',
  'DD/MM/YYYY',
  '12-hour',
  true,
  true,
  true,
  true,
  true,
  '09:00',
  true,
  false,
  false,
  1,
  '[]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_settings WHERE user_id = auth.uid()
);