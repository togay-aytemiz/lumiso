-- Add project_type_id column to projects table
ALTER TABLE public.projects 
ADD COLUMN project_type_id UUID;

-- Create foreign key constraint to project_types table
ALTER TABLE public.projects 
ADD CONSTRAINT fk_projects_project_type 
FOREIGN KEY (project_type_id) REFERENCES public.project_types(id) ON DELETE SET NULL;

-- Create index for better performance on project type queries
CREATE INDEX idx_projects_project_type_id ON public.projects(project_type_id);

-- Migration script to assign default project type to existing projects
DO $$
DECLARE
    user_record RECORD;
    default_type_id UUID;
BEGIN
    -- For each user, assign their default project type to projects without one
    FOR user_record IN SELECT DISTINCT user_id FROM public.projects WHERE project_type_id IS NULL
    LOOP
        -- Get the default project type for this user
        SELECT id INTO default_type_id 
        FROM public.project_types 
        WHERE user_id = user_record.user_id AND is_default = true
        LIMIT 1;
        
        -- If no default type found, get the first available type for this user
        IF default_type_id IS NULL THEN
            SELECT id INTO default_type_id 
            FROM public.project_types 
            WHERE user_id = user_record.user_id 
            ORDER BY created_at ASC 
            LIMIT 1;
        END IF;
        
        -- Update projects for this user if we found a type
        IF default_type_id IS NOT NULL THEN
            UPDATE public.projects 
            SET project_type_id = default_type_id 
            WHERE user_id = user_record.user_id AND project_type_id IS NULL;
        END IF;
    END LOOP;
END $$;