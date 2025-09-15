-- V3 Onboarding System: Production Database Migration
-- Clean up any remaining old onboarding columns and ensure optimal performance

-- Create function to safely drop old columns if they exist
CREATE OR REPLACE FUNCTION public.cleanup_old_onboarding_columns_v3()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cleanup_result TEXT := '';
  column_exists BOOLEAN;
BEGIN
  -- Check and drop old columns one by one
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' 
    AND column_name = 'in_guided_setup'
    AND table_schema = 'public'
  ) INTO column_exists;
  
  IF column_exists THEN
    ALTER TABLE user_settings DROP COLUMN in_guided_setup;
    cleanup_result := cleanup_result || 'Dropped in_guided_setup; ';
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' 
    AND column_name = 'guided_setup_skipped'
    AND table_schema = 'public'
  ) INTO column_exists;
  
  IF column_exists THEN
    ALTER TABLE user_settings DROP COLUMN guided_setup_skipped;
    cleanup_result := cleanup_result || 'Dropped guided_setup_skipped; ';
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' 
    AND column_name = 'guidance_completed'
    AND table_schema = 'public'
  ) INTO column_exists;
  
  IF column_exists THEN
    ALTER TABLE user_settings DROP COLUMN guidance_completed;
    cleanup_result := cleanup_result || 'Dropped guidance_completed; ';
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' 
    AND column_name = 'current_step'
    AND table_schema = 'public'
  ) INTO column_exists;
  
  IF column_exists THEN
    ALTER TABLE user_settings DROP COLUMN current_step;
    cleanup_result := cleanup_result || 'Dropped current_step; ';
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' 
    AND column_name = 'completed_steps'
    AND table_schema = 'public'
  ) INTO column_exists;
  
  IF column_exists THEN
    ALTER TABLE user_settings DROP COLUMN completed_steps;
    cleanup_result := cleanup_result || 'Dropped completed_steps; ';
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' 
    AND column_name = 'completed_steps_count'
    AND table_schema = 'public'
  ) INTO column_exists;
  
  IF column_exists THEN
    ALTER TABLE user_settings DROP COLUMN completed_steps_count;
    cleanup_result := cleanup_result || 'Dropped completed_steps_count; ';
  END IF;
  
  IF cleanup_result = '' THEN
    cleanup_result := 'No old columns found - database already clean';
  END IF;
  
  RETURN cleanup_result;
END;
$$;

-- Create performance monitoring function for onboarding queries
CREATE OR REPLACE FUNCTION public.get_onboarding_performance_stats()
RETURNS TABLE (
  total_users INTEGER,
  completed_onboarding INTEGER,
  in_progress INTEGER,
  not_started INTEGER,
  avg_steps_completed NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COUNT(*)::INTEGER as total_users,
    COUNT(CASE WHEN onboarding_stage = 'completed' THEN 1 END)::INTEGER as completed_onboarding,
    COUNT(CASE WHEN onboarding_stage = 'in_progress' THEN 1 END)::INTEGER as in_progress,
    COUNT(CASE WHEN onboarding_stage = 'not_started' THEN 1 END)::INTEGER as not_started,
    AVG(COALESCE(current_onboarding_step, 0))::NUMERIC as avg_steps_completed
  FROM user_settings
  WHERE user_id IS NOT NULL;
$$;

-- Create index for optimal onboarding query performance
CREATE INDEX IF NOT EXISTS idx_user_settings_onboarding_performance 
ON user_settings (user_id, onboarding_stage, current_onboarding_step) 
WHERE onboarding_stage IS NOT NULL;