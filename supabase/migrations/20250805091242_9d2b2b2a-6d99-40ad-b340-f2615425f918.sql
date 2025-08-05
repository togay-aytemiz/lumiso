-- Add sort_order column to project_statuses table
ALTER TABLE public.project_statuses 
ADD COLUMN sort_order INTEGER;

-- Create a function to set initial sort order values
CREATE OR REPLACE FUNCTION public.set_initial_sort_order()
RETURNS void AS $$
DECLARE
    user_rec RECORD;
    status_rec RECORD;
    counter INTEGER;
BEGIN
    -- Loop through each user
    FOR user_rec IN SELECT DISTINCT user_id FROM public.project_statuses
    LOOP
        counter := 1;
        -- Update sort_order for each user's statuses based on created_at
        FOR status_rec IN 
            SELECT id FROM public.project_statuses 
            WHERE user_id = user_rec.user_id 
            ORDER BY created_at
        LOOP
            UPDATE public.project_statuses 
            SET sort_order = counter 
            WHERE id = status_rec.id;
            counter := counter + 1;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to set initial values
SELECT public.set_initial_sort_order();

-- Drop the function as it's no longer needed
DROP FUNCTION public.set_initial_sort_order();

-- Make sort_order NOT NULL after setting values
ALTER TABLE public.project_statuses 
ALTER COLUMN sort_order SET NOT NULL;

-- Add default value for new records
ALTER TABLE public.project_statuses 
ALTER COLUMN sort_order SET DEFAULT 1;