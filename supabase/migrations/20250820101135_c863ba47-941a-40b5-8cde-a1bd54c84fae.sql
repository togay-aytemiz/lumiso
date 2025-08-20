-- Reset all statuses to default for all existing users
-- Handle foreign key constraints properly

DO $$
DECLARE
    org_record RECORD;
    new_lead_status_id uuid;
    new_project_status_id uuid;
    new_session_status_id uuid;
BEGIN
    -- Step 1: Set all foreign key references to NULL temporarily
    UPDATE public.projects SET status_id = NULL, previous_status_id = NULL;
    UPDATE public.leads SET status_id = NULL;
    UPDATE public.sessions SET status = 'planned';  -- Use enum default
    
    -- Step 2: Delete all existing statuses
    DELETE FROM public.lead_statuses;
    DELETE FROM public.project_statuses; 
    DELETE FROM public.session_statuses;
    
    -- Step 3: Recreate default statuses for all organizations
    FOR org_record IN 
        SELECT DISTINCT o.id as org_id, o.owner_id as user_id
        FROM public.organizations o
    LOOP
        -- Create default lead statuses
        INSERT INTO public.lead_statuses (user_id, organization_id, name, color, is_system_final, sort_order, is_default)
        VALUES 
            (org_record.user_id, org_record.org_id, 'New', '#A0AEC0', false, 1, true),
            (org_record.user_id, org_record.org_id, 'Contacted', '#4299E1', false, 2, false),
            (org_record.user_id, org_record.org_id, 'Qualified', '#48BB78', false, 3, false),
            (org_record.user_id, org_record.org_id, 'Booked', '#9F7AEA', false, 4, false),
            (org_record.user_id, org_record.org_id, 'Not Interested', '#F56565', false, 5, false),
            (org_record.user_id, org_record.org_id, 'Completed', '#22c55e', true, 1000, false),
            (org_record.user_id, org_record.org_id, 'Lost', '#ef4444', true, 1001, false);
        
        -- Get the default lead status ID
        SELECT id INTO new_lead_status_id
        FROM public.lead_statuses 
        WHERE organization_id = org_record.org_id AND is_default = true
        LIMIT 1;
        
        -- Create default project statuses
        INSERT INTO public.project_statuses (user_id, organization_id, name, color, sort_order)
        VALUES 
            (org_record.user_id, org_record.org_id, 'Planned', '#A0AEC0', 1),
            (org_record.user_id, org_record.org_id, 'In Progress', '#4299E1', 2),
            (org_record.user_id, org_record.org_id, 'Completed', '#48BB78', 3),
            (org_record.user_id, org_record.org_id, 'On Hold', '#F59E0B', 4),
            (org_record.user_id, org_record.org_id, 'Cancelled', '#F56565', 5);
        
        -- Get the default project status ID (first one - Planned)
        SELECT id INTO new_project_status_id
        FROM public.project_statuses 
        WHERE organization_id = org_record.org_id AND sort_order = 1
        LIMIT 1;
        
        -- Create default session statuses
        INSERT INTO public.session_statuses (user_id, organization_id, name, color, sort_order, is_system_initial)
        VALUES 
            (org_record.user_id, org_record.org_id, 'Planned', '#A0AEC0', 1, true),
            (org_record.user_id, org_record.org_id, 'Confirmed', '#ECC94B', 2, false),
            (org_record.user_id, org_record.org_id, 'Editing', '#9F7AEA', 3, false),
            (org_record.user_id, org_record.org_id, 'Delivered', '#4299E1', 4, false),
            (org_record.user_id, org_record.org_id, 'Completed', '#48BB78', 5, false),
            (org_record.user_id, org_record.org_id, 'Cancelled', '#F56565', 6, false);
        
        -- Step 4: Update existing records to use new default status IDs
        UPDATE public.leads 
        SET status_id = new_lead_status_id
        WHERE organization_id = org_record.org_id;
        
        UPDATE public.projects 
        SET status_id = new_project_status_id
        WHERE organization_id = org_record.org_id;
        
        -- Sessions use enum, so they're already set to 'planned'
        
        RAISE NOTICE 'Reset statuses for organization: %', org_record.org_id;
    END LOOP;
    
    RAISE NOTICE 'Successfully reset all statuses to defaults for all organizations';
END $$;