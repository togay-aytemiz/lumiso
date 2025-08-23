-- Add permanent field to track if user has ever seen welcome modal
ALTER TABLE user_settings 
ADD COLUMN welcome_modal_shown boolean NOT NULL DEFAULT false;

-- Update existing users who have started onboarding to mark modal as shown
UPDATE user_settings 
SET welcome_modal_shown = true 
WHERE onboarding_stage != 'not_started';