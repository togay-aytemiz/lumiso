-- Check if assignees columns exist in leads and projects tables, if not add them
DO $$
BEGIN
    -- Add assignees column to leads table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'assignees') THEN
        ALTER TABLE public.leads ADD COLUMN assignees UUID[] DEFAULT ARRAY[]::UUID[];
    END IF;
    
    -- Add assignees column to projects table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'assignees') THEN
        ALTER TABLE public.projects ADD COLUMN assignees UUID[] DEFAULT ARRAY[]::UUID[];
    END IF;
END $$;