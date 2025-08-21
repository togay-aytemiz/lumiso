-- Add the new onboarding_stage enum and column
CREATE TYPE onboarding_stage AS ENUM (
  'not_started',      -- User hasn't seen onboarding yet
  'modal_shown',      -- Welcome modal was shown, waiting for choice
  'in_progress',      -- User chose guided setup, currently doing steps
  'completed',        -- User finished all steps successfully  
  'skipped'          -- User chose to skip with sample data
);

-- Add the new column to user_settings
ALTER TABLE user_settings 
ADD COLUMN onboarding_stage onboarding_stage DEFAULT 'not_started';

-- Migrate existing data to new column
UPDATE user_settings 
SET onboarding_stage = CASE
  WHEN guidance_completed = true THEN 'completed'::onboarding_stage
  WHEN guided_setup_skipped = true THEN 'skipped'::onboarding_stage  
  WHEN in_guided_setup = true THEN 'in_progress'::onboarding_stage
  ELSE 'not_started'::onboarding_stage
END;

-- Set NOT NULL constraint after migration
ALTER TABLE user_settings 
ALTER COLUMN onboarding_stage SET NOT NULL;

-- Add current_onboarding_step for tracking progress within guided setup
ALTER TABLE user_settings 
ADD COLUMN current_onboarding_step INTEGER DEFAULT 1;

-- Update current step based on completed_steps_count 
UPDATE user_settings 
SET current_onboarding_step = LEAST(completed_steps_count + 1, 6);

-- Clean up old columns (we'll do this after testing)
-- We'll keep them for now during transition