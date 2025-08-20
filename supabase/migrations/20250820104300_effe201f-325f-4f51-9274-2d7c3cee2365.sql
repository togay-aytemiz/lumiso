-- Phase 1: Add lifecycle field to status tables
-- This is idempotent and safe to rerun

-- Add lifecycle column to lead_statuses (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'lead_statuses' AND column_name = 'lifecycle') THEN
        ALTER TABLE lead_statuses 
        ADD COLUMN lifecycle TEXT DEFAULT 'active' 
        CHECK (lifecycle IN ('active','completed','cancelled','archived'));
    END IF;
END $$;

-- Add lifecycle column to project_statuses (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'project_statuses' AND column_name = 'lifecycle') THEN
        ALTER TABLE project_statuses 
        ADD COLUMN lifecycle TEXT DEFAULT 'active' 
        CHECK (lifecycle IN ('active','completed','cancelled','archived'));
    END IF;
END $$;

-- Add lifecycle column to session_statuses (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'session_statuses' AND column_name = 'lifecycle') THEN
        ALTER TABLE session_statuses 
        ADD COLUMN lifecycle TEXT DEFAULT 'active' 
        CHECK (lifecycle IN ('active','completed','cancelled','archived'));
    END IF;
END $$;

-- Backfill lead_statuses based on name patterns (case-insensitive)
UPDATE lead_statuses 
SET lifecycle = CASE 
    WHEN LOWER(name) LIKE '%completed%' THEN 'completed'
    WHEN LOWER(name) LIKE '%lost%' THEN 'cancelled' 
    WHEN LOWER(name) LIKE '%archived%' THEN 'archived'
    ELSE 'active'
END
WHERE lifecycle = 'active'; -- Only update rows that haven't been manually set

-- Backfill project_statuses based on name patterns
UPDATE project_statuses
SET lifecycle = CASE
    WHEN LOWER(name) LIKE '%completed%' THEN 'completed'
    WHEN LOWER(name) LIKE '%cancelled%' THEN 'cancelled'
    ELSE 'active' 
END
WHERE lifecycle = 'active'; -- Only update rows that haven't been manually set

-- Backfill session_statuses based on name patterns
UPDATE session_statuses
SET lifecycle = CASE
    WHEN LOWER(name) LIKE '%delivered%' OR LOWER(name) LIKE '%completed%' THEN 'completed'
    WHEN LOWER(name) LIKE '%cancelled%' THEN 'cancelled'  
    ELSE 'active'
END
WHERE lifecycle = 'active'; -- Only update rows that haven't been manually set