-- Clean up conflicting onboarding state for all users
-- Fix users who have in_progress stage but old completed flags
UPDATE user_settings 
SET 
  in_guided_setup = NULL,
  guided_setup_skipped = NULL, 
  guidance_completed = NULL,
  current_step = NULL,
  completed_steps = NULL,
  completed_steps_count = NULL
WHERE onboarding_stage IN ('in_progress', 'completed', 'skipped');

-- Ensure users with in_progress stage have consistent current step
UPDATE user_settings 
SET current_onboarding_step = 1 
WHERE onboarding_stage = 'in_progress' AND (current_onboarding_step IS NULL OR current_onboarding_step < 1);