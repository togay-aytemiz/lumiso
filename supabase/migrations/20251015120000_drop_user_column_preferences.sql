-- Drop column customization persistence now that the UI no longer supports it
DROP TRIGGER IF EXISTS update_user_column_preferences_updated_at
ON public.user_column_preferences;

DROP POLICY IF EXISTS "Users can delete their own column preferences"
ON public.user_column_preferences;

DROP POLICY IF EXISTS "Users can update their own column preferences"
ON public.user_column_preferences;

DROP POLICY IF EXISTS "Users can create their own column preferences"
ON public.user_column_preferences;

DROP POLICY IF EXISTS "Users can view their own column preferences"
ON public.user_column_preferences;

DROP TABLE IF EXISTS public.user_column_preferences;
