-- Phase 1: Remove unused onboarding columns from user_settings table
ALTER TABLE public.user_settings 
DROP COLUMN IF EXISTS in_guided_setup,
DROP COLUMN IF EXISTS guided_setup_skipped,
DROP COLUMN IF EXISTS guidance_completed,
DROP COLUMN IF EXISTS current_step,
DROP COLUMN IF EXISTS completed_steps,
DROP COLUMN IF EXISTS completed_steps_count;

-- Phase 2: Update onboarding_stage enum to remove unused 'modal_shown' stage
-- First remove the default
ALTER TABLE public.user_settings ALTER COLUMN onboarding_stage DROP DEFAULT;

-- Create the new enum without 'modal_shown'
CREATE TYPE onboarding_stage_new AS ENUM ('not_started', 'in_progress', 'completed', 'skipped');

-- Update the column to use the new enum
ALTER TABLE public.user_settings 
ALTER COLUMN onboarding_stage TYPE onboarding_stage_new 
USING onboarding_stage::text::onboarding_stage_new;

-- Set the new default
ALTER TABLE public.user_settings ALTER COLUMN onboarding_stage SET DEFAULT 'not_started'::onboarding_stage_new;

-- Drop the old enum and rename the new one
DROP TYPE onboarding_stage;
ALTER TYPE onboarding_stage_new RENAME TO onboarding_stage;

-- Clean up any database functions that reference the old columns
DROP FUNCTION IF EXISTS public.set_guided_step(uuid, integer);
DROP FUNCTION IF EXISTS public.advance_guided_step(uuid, integer, boolean);
DROP FUNCTION IF EXISTS public.reset_guided_setup(uuid);
DROP FUNCTION IF EXISTS public.complete_onboarding_step(uuid);