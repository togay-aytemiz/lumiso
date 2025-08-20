-- Reset all statuses to default for all existing users
-- This will delete all custom statuses and recreate defaults

-- First, get all active organizations
DO $$
DECLARE
    org_record RECORD;
    user_record RECORD;
BEGIN
    -- Delete all existing lead statuses
    DELETE FROM public.lead_statuses;
    
    -- Delete all existing project statuses  
    DELETE FROM public.project_statuses;
    
    -- Delete all existing session statuses
    DELETE FROM public.session_statuses;
    
    -- Recreate default statuses for all organizations
    FOR org_record IN 
        SELECT DISTINCT o.id as org_id, o.owner_id as user_id
        FROM public.organizations o
    LOOP
        -- Create default lead statuses for this organization
        INSERT INTO public.lead_statuses (user_id, organization_id, name, color, is_system_final, sort_order, is_default)
        VALUES 
            -- System statuses
            (org_record.user_id, org_record.org_id, 'Completed', '#22c55e', true, 1000, false),
            (org_record.user_id, org_record.org_id, 'Lost', '#ef4444', true, 1001, false),
            -- Default custom statuses
            (org_record.user_id, org_record.org_id, 'New', '#A0AEC0', false, 1, true),
            (org_record.user_id, org_record.org_id, 'Contacted', '#4299E1', false, 2, false),
            (org_record.user_id, org_record.org_id, 'Qualified', '#48BB78', false, 3, false),
            (org_record.user_id, org_record.org_id, 'Booked', '#9F7AEA', false, 4, false),
            (org_record.user_id, org_record.org_id, 'Not Interested', '#F56565', false, 5, false);
        
        -- Create default project statuses for this organization
        INSERT INTO public.project_statuses (user_id, organization_id, name, color, sort_order)
        VALUES 
            (org_record.user_id, org_record.org_id, 'Planned', '#A0AEC0', 1),
            (org_record.user_id, org_record.org_id, 'In Progress', '#4299E1', 2),
            (org_record.user_id, org_record.org_id, 'Completed', '#48BB78', 3),
            (org_record.user_id, org_record.org_id, 'On Hold', '#F59E0B', 4),
            (org_record.user_id, org_record.org_id, 'Cancelled', '#F56565', 5);
        
        -- Create default session statuses for this organization  
        INSERT INTO public.session_statuses (user_id, organization_id, name, color, sort_order, is_system_initial)
        VALUES 
            (org_record.user_id, org_record.org_id, 'Planned', '#A0AEC0', 1, true),
            (org_record.user_id, org_record.org_id, 'Confirmed', '#ECC94B', 2, false),
            (org_record.user_id, org_record.org_id, 'Editing', '#9F7AEA', 3, false),
            (org_record.user_id, org_record.org_id, 'Delivered', '#4299E1', 4, false),
            (org_record.user_id, org_record.org_id, 'Completed', '#48BB78', 5, false),
            (org_record.user_id, org_record.org_id, 'Cancelled', '#F56565', 6, false);
            
        RAISE NOTICE 'Reset statuses for organization: %', org_record.org_id;
    END LOOP;
    
    RAISE NOTICE 'Successfully reset all statuses to defaults for all organizations';
END $$;