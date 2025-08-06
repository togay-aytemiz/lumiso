-- Fix the user_settings table to handle updates properly
-- The error suggests there's a unique constraint issue with upserts

-- First, let's check if we need to modify the user_settings table structure
-- Drop the unique constraint if it exists and recreate it properly
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_key;

-- Add the proper unique constraint
ALTER TABLE user_settings ADD CONSTRAINT user_settings_user_id_unique UNIQUE (user_id);

-- Make sure the table structure is correct for upserts
-- The upsert should work with this constraint