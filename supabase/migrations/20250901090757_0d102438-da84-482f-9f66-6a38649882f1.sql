-- Comprehensive Photography Business Seed Data
-- Corrected version with proper table structure

DO $$
DECLARE
    org_id UUID := '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45';
    current_user_id UUID;
    
    -- Status IDs
    new_status_id UUID;
    contacted_status_id UUID;
    qualified_status_id UUID;
    booked_status_id UUID;
    completed_status_id UUID;
    lost_status_id UUID;
    
    -- Project Status IDs  
    planned_proj_status_id UUID;
    progress_proj_status_id UUID;
    completed_proj_status_id UUID;
    
    -- Project Type IDs
    wedding_type_id UUID;
    newborn_type_id UUID;
    family_type_id UUID;
    corporate_type_id UUID;
    portrait_type_id UUID;
    maternity_type_id UUID;
    
    -- Lead and Project IDs for relationships
    lead_ids UUID[];
    project_ids UUID[];
    
BEGIN
    -- Get a valid user ID from organization members
    SELECT user_id INTO current_user_id 
    FROM organization_members 
    WHERE organization_id = org_id AND status = 'active' 
    LIMIT 1;
    
    -- Exit if no user found
    IF current_user_id IS NULL THEN
        RAISE NOTICE 'No active user found for organization %', org_id;
        RETURN;
    END IF;
    
    -- Get status IDs
    SELECT id INTO new_status_id FROM lead_statuses WHERE organization_id = org_id AND name = 'New';
    SELECT id INTO contacted_status_id FROM lead_statuses WHERE organization_id = org_id AND name = 'Contacted';
    SELECT id INTO qualified_status_id FROM lead_statuses WHERE organization_id = org_id AND name = 'Qualified';
    SELECT id INTO booked_status_id FROM lead_statuses WHERE organization_id = org_id AND name = 'Booked';
    SELECT id INTO completed_status_id FROM lead_statuses WHERE organization_id = org_id AND name = 'Completed';
    SELECT id INTO lost_status_id FROM lead_statuses WHERE organization_id = org_id AND name = 'Lost';
    
    -- Get project status IDs
    SELECT id INTO planned_proj_status_id FROM project_statuses WHERE organization_id = org_id AND name = 'Planned';
    SELECT id INTO progress_proj_status_id FROM project_statuses WHERE organization_id = org_id AND name = 'In Progress';
    SELECT id INTO completed_proj_status_id FROM project_statuses WHERE organization_id = org_id AND name = 'Completed';
    
    -- Get project type IDs
    SELECT id INTO wedding_type_id FROM project_types WHERE organization_id = org_id AND name = 'Wedding';
    SELECT id INTO newborn_type_id FROM project_types WHERE organization_id = org_id AND name = 'Newborn';
    SELECT id INTO family_type_id FROM project_types WHERE organization_id = org_id AND name = 'Family';
    SELECT id INTO corporate_type_id FROM project_types WHERE organization_id = org_id AND name = 'Corporate';
    SELECT id INTO portrait_type_id FROM project_types WHERE organization_id = org_id AND name = 'Portrait';
    SELECT id INTO maternity_type_id FROM project_types WHERE organization_id = org_id AND name = 'Maternity';

    -- Create 15 realistic leads with various statuses
    WITH new_leads AS (
        INSERT INTO leads (user_id, organization_id, name, email, phone, notes, status, status_id, assignees, due_date, created_at, updated_at)
        VALUES 
            -- Active Pipeline (New Status)
            (current_user_id, org_id, 'Emily & James Anderson', 'emily.anderson@email.com', '+1 (555) 123-4567', 'Interested in outdoor wedding photography for June 2024. Venue: Botanical Gardens.', 'New', new_status_id, ARRAY[current_user_id], '2024-02-15', now() - interval '2 days', now() - interval '2 days'),
            (current_user_id, org_id, 'Sarah Johnson', 'sarah.johnson@gmail.com', '+1 (555) 234-5678', 'Looking for newborn session. Baby due in March 2024.', 'New', new_status_id, ARRAY[current_user_id], '2024-02-20', now() - interval '1 day', now() - interval '1 day'),
            (current_user_id, org_id, 'Michael Rodriguez', 'mrodriguez@techcorp.com', '+1 (555) 345-6789', 'Corporate headshots for 15 employees. Budget: $3000.', 'New', new_status_id, ARRAY[current_user_id], '2024-02-25', now() - interval '3 hours', now() - interval '3 hours'),
            
            -- Contacted Status
            (current_user_id, org_id, 'Lisa & David Chen', 'lisa.chen@email.com', '+1 (555) 456-7890', 'Anniversary couple session. Celebrating 10 years. Sent initial package info.', 'Contacted', contacted_status_id, ARRAY[current_user_id], '2024-02-18', now() - interval '5 days', now() - interval '1 day'),
            (current_user_id, org_id, 'Jessica Martinez', 'j.martinez@email.com', '+1 (555) 567-8901', 'Maternity session at 32 weeks. Discussed outdoor location options.', 'Contacted', contacted_status_id, ARRAY[current_user_id], '2024-02-22', now() - interval '4 days', now() - interval '2 days'),
            (current_user_id, org_id, 'The Thompson Family', 'mom.thompson@email.com', '+1 (555) 678-9012', 'Extended family portrait session. 3 generations, 12 people total.', 'Contacted', contacted_status_id, ARRAY[current_user_id], '2024-03-01', now() - interval '3 days', now() - interval '1 day'),
            
            -- Qualified Status
            (current_user_id, org_id, 'Amanda Williams', 'amanda.w@email.com', '+1 (555) 789-0123', 'Professional headshots for LinkedIn. Approved budget and timeline.', 'Qualified', qualified_status_id, ARRAY[current_user_id], '2024-02-28', now() - interval '6 days', now() - interval '2 days'),
            (current_user_id, org_id, 'Robert & Michelle Davis', 'rdavis@email.com', '+1 (555) 890-1234', 'Wedding photography for September 2024. Reviewed contract terms.', 'Qualified', qualified_status_id, ARRAY[current_user_id], '2024-03-05', now() - interval '7 days', now() - interval '1 day'),
            
            -- Booked Status
            (current_user_id, org_id, 'Grace & Oliver Wilson', 'grace.wilson@email.com', '+1 (555) 012-3456', 'Spring wedding at Riverside Manor. Contract signed, deposit received.', 'Booked', booked_status_id, ARRAY[current_user_id], '2024-05-15', now() - interval '10 days', now() - interval '1 day'),
            (current_user_id, org_id, 'Emma Turner', 'emma.turner@email.com', '+1 (555) 123-4567', 'Newborn session for baby Elif. Session scheduled for next week.', 'Booked', booked_status_id, ARRAY[current_user_id], '2024-02-20', now() - interval '12 days', now() - interval '3 days'),
            
            -- Completed Status
            (current_user_id, org_id, 'Sophia & Alexander Brown', 'sophia.brown@email.com', '+1 (555) 345-6789', 'Beautiful winter wedding at Mountain Lodge. Gallery delivered, final payment received.', 'Completed', completed_status_id, ARRAY[current_user_id], NULL, now() - interval '45 days', now() - interval '5 days'),
            (current_user_id, org_id, 'Innovation Labs', 'hr@innovationlabs.com', '+1 (555) 456-7890', 'Executive team portraits completed. All 8 executives photographed professionally.', 'Completed', completed_status_id, ARRAY[current_user_id], NULL, now() - interval '30 days', now() - interval '7 days'),
            
            -- Lost Status  
            (current_user_id, org_id, 'Rachel & Kevin Garcia', 'rachel.garcia@email.com', '+1 (555) 678-9012', 'Wedding inquiry but chose another photographer due to scheduling conflicts.', 'Lost', lost_status_id, ARRAY[current_user_id], NULL, now() - interval '25 days', now() - interval '15 days'),
            (current_user_id, org_id, 'Corporate Solutions Ltd', 'marketing@corpsol.com', '+1 (555) 789-0123', 'Event photography inquiry but project was cancelled by client.', 'Lost', lost_status_id, ARRAY[current_user_id], NULL, now() - interval '18 days', now() - interval '12 days'),
            (current_user_id, org_id, 'Taylor Johnson', 'taylor.j@email.com', '+1 (555) 890-1234', 'Portrait session inquiry but budget did not match our packages.', 'Lost', lost_status_id, ARRAY[current_user_id], NULL, now() - interval '35 days', now() - interval '20 days')
        RETURNING id
    )
    SELECT ARRAY_AGG(id) INTO lead_ids FROM new_leads;

    -- Create custom field values for newborn leads  
    INSERT INTO lead_field_values (lead_id, field_key, value)
    VALUES 
        (lead_ids[2], 'Bebek Adı', 'Ayşe'),
        (lead_ids[10], 'Bebek Adı', 'Elif');

    -- Create 10 projects linked to leads (without due_date column)
    WITH new_projects AS (
        INSERT INTO projects (user_id, organization_id, lead_id, name, description, project_type_id, status_id, assignees, base_price, created_at, updated_at)
        VALUES 
            -- Wedding Projects
            (current_user_id, org_id, lead_ids[1], 'Anderson Wedding Photography', 'Outdoor wedding at Botanical Gardens. Full day coverage with engagement session included.', wedding_type_id, planned_proj_status_id, ARRAY[current_user_id], 3500, now() - interval '2 days', now() - interval '2 days'),
            (current_user_id, org_id, lead_ids[8], 'Davis Wedding Photography', 'September wedding with rustic theme. Ceremony and reception coverage.', wedding_type_id, progress_proj_status_id, ARRAY[current_user_id], 4200, now() - interval '7 days', now() - interval '1 day'),
            (current_user_id, org_id, lead_ids[9], 'Wilson Spring Wedding', 'Elegant spring wedding at Riverside Manor. Premium package with videography.', wedding_type_id, progress_proj_status_id, ARRAY[current_user_id], 5500, now() - interval '10 days', now() - interval '1 day'),
            (current_user_id, org_id, lead_ids[11], 'Brown Winter Wedding', 'Completed winter wedding with mountain backdrop. Premium album delivered.', wedding_type_id, completed_proj_status_id, ARRAY[current_user_id], 4800, now() - interval '45 days', now() - interval '5 days'),
            
            -- Newborn Projects
            (current_user_id, org_id, lead_ids[2], 'Baby Ayşe Newborn Session', 'Lifestyle newborn photography at family home. Props and editing included.', newborn_type_id, planned_proj_status_id, ARRAY[current_user_id], 800, now() - interval '1 day', now() - interval '1 day'),
            (current_user_id, org_id, lead_ids[10], 'Baby Elif Newborn Session', 'Studio newborn session with custom setup. Family shots included.', newborn_type_id, progress_proj_status_id, ARRAY[current_user_id], 950, now() - interval '12 days', now() - interval '3 days'),
            
            -- Family & Corporate Projects
            (current_user_id, org_id, lead_ids[6], 'Thompson Extended Family', 'Multi-generational family portrait session. Indoor and outdoor combinations.', family_type_id, progress_proj_status_id, ARRAY[current_user_id], 650, now() - interval '3 days', now() - interval '1 day'),
            (current_user_id, org_id, lead_ids[3], 'TechCorp Headshots', 'Professional headshots for 15 employees. Studio and environmental options.', corporate_type_id, planned_proj_status_id, ARRAY[current_user_id], 3000, now() - interval '3 hours', now() - interval '3 hours'),
            (current_user_id, org_id, lead_ids[12], 'Innovation Labs Executive Portraits', 'Completed executive team portraits with branding elements.', corporate_type_id, completed_proj_status_id, ARRAY[current_user_id], 2400, now() - interval '30 days', now() - interval '7 days'),
            (current_user_id, org_id, lead_ids[7], 'Amanda Professional Headshots', 'LinkedIn-ready professional portraits with multiple outfit changes.', portrait_type_id, planned_proj_status_id, ARRAY[current_user_id], 450, now() - interval '6 days', now() - interval '2 days')
        RETURNING id
    )
    SELECT ARRAY_AGG(id) INTO project_ids FROM new_projects;

    -- Create 12 sessions linked to projects (using 'planned' for status)
    INSERT INTO sessions (user_id, organization_id, lead_id, project_id, session_date, session_time, status, location, notes, created_at, updated_at)
    VALUES 
        -- Future planned sessions
        (current_user_id, org_id, lead_ids[1], project_ids[1], '2024-06-15', '14:00:00', 'planned', 'Botanical Gardens - Rose Garden Section', 'Wedding ceremony starts at 2 PM. Arrive 1 hour early for prep shots.', now() - interval '2 days', now() - interval '2 days'),
        (current_user_id, org_id, lead_ids[2], project_ids[5], '2024-03-10', '10:00:00', 'planned', 'Client Home - Nursery Setup', 'Newborn session for baby Ayşe. Bring props and heating equipment.', now() - interval '1 day', now() - interval '1 day'),
        (current_user_id, org_id, lead_ids[10], project_ids[6], '2024-02-20', '15:00:00', 'confirmed', 'Studio A - Newborn Setup', 'Baby Elif newborn session. Parents want natural lighting setup.', now() - interval '12 days', now() - interval '3 days'),
        (current_user_id, org_id, lead_ids[3], project_ids[8], '2024-03-01', '09:00:00', 'confirmed', 'TechCorp Office - Conference Room B', '15 employee headshots. Professional attire. 2-hour session.', now() - interval '3 hours', now() - interval '3 hours'),
        (current_user_id, org_id, lead_ids[6], project_ids[7], '2024-03-15', '16:00:00', 'planned', 'Riverside Park - Main Pavilion', 'Extended family session for 12 people. Golden hour timing.', now() - interval '3 days', now() - interval '1 day'),
        
        -- Current/recent sessions  
        (current_user_id, org_id, lead_ids[5], project_ids[5], '2024-02-10', '17:30:00', 'editing', 'Sunset Point - Overlook Trail', 'Beautiful maternity session completed. 150+ photos taken.', now() - interval '4 days', now() - interval '2 days'),
        (current_user_id, org_id, lead_ids[7], project_ids[10], '2024-02-08', '11:00:00', 'editing', 'Studio B - Professional Setup', 'Professional headshots completed. 3 outfit changes, multiple backgrounds.', now() - interval '6 days', now() - interval '2 days'),
        
        -- Completed sessions
        (current_user_id, org_id, lead_ids[11], project_ids[4], '2023-12-15', '13:00:00', 'completed', 'Mountain Lodge - Great Hall', 'Beautiful winter wedding. Snowy backdrop perfect for ceremony shots.', now() - interval '45 days', now() - interval '5 days'),
        (current_user_id, org_id, lead_ids[12], project_ids[9], '2023-12-20', '10:00:00', 'completed', 'Innovation Labs - Executive Boardroom', 'Executive team portraits completed. Professional lighting, corporate branding.', now() - interval '30 days', now() - interval '7 days'),
        
        -- Engagement sessions for weddings
        (current_user_id, org_id, lead_ids[8], project_ids[2], '2024-02-14', '17:00:00', 'delivered', 'Downtown Arts District', 'Engagement session for Davis couple. Urban backdrop with vintage feel.', now() - interval '7 days', now() - interval '1 day'),
        (current_user_id, org_id, lead_ids[9], project_ids[3], '2024-01-20', '15:30:00', 'completed', 'Riverside Manor - Gardens', 'Engagement photos at wedding venue. Couple loved the location scouting.', now() - interval '10 days', now() - interval '1 day'),
        
        -- Cancelled session  
        (current_user_id, org_id, lead_ids[13], NULL, '2024-01-15', '14:00:00', 'cancelled', 'Originally: Beach Sunset Location', 'Session cancelled due to client schedule changes.', now() - interval '25 days', now() - interval '15 days');

    -- Create meaningful activities and reminders
    INSERT INTO activities (user_id, organization_id, lead_id, project_id, type, content, reminder_date, reminder_time, completed, created_at, updated_at)
    VALUES 
        -- Notes and follow-ups for leads
        (current_user_id, org_id, lead_ids[1], project_ids[1], 'note', 'Initial consultation completed. Client loves outdoor concept and wants additional engagement session.', NULL, NULL, false, now() - interval '2 days', now() - interval '2 days'),
        (current_user_id, org_id, lead_ids[2], project_ids[5], 'note', 'Discussed newborn photography timeline. Client prefers home session for comfort.', NULL, NULL, false, now() - interval '1 day', now() - interval '1 day'),
        (current_user_id, org_id, lead_ids[3], project_ids[8], 'reminder', 'Follow up on TechCorp headshot scheduling', '2024-02-16', '10:00:00', false, now() - interval '3 hours', now() - interval '3 hours'),
        (current_user_id, org_id, lead_ids[8], project_ids[2], 'note', 'Contract signed! Deposit received. Couple is very excited about September date.', NULL, NULL, false, now() - interval '7 days', now() - interval '1 day'),
        (current_user_id, org_id, lead_ids[9], project_ids[3], 'reminder', 'Send final wedding timeline to Wilson couple', '2024-02-18', '14:00:00', false, now() - interval '10 days', now() - interval '1 day'),
        
        -- Completed activities
        (current_user_id, org_id, lead_ids[11], project_ids[4], 'note', 'Wedding gallery delivered to Brown couple. They absolutely loved the mountain backdrop shots!', NULL, NULL, true, now() - interval '45 days', now() - interval '5 days'),
        (current_user_id, org_id, lead_ids[12], project_ids[9], 'note', 'Executive portraits delivered to Innovation Labs. HR department very satisfied with results.', NULL, NULL, true, now() - interval '30 days', now() - interval '7 days'),
        
        -- Project-specific activities
        (current_user_id, org_id, lead_ids[5], project_ids[5], 'reminder', 'Edit and deliver Jessica maternity photos', '2024-02-15', '09:00:00', false, now() - interval '4 days', now() - interval '2 days'),
        (current_user_id, org_id, lead_ids[7], project_ids[10], 'reminder', 'Deliver Amanda professional headshots', '2024-02-14', '16:00:00', false, now() - interval '6 days', now() - interval '2 days');

    -- Create todo items for projects
    INSERT INTO todos (project_id, user_id, content, is_completed, created_at, updated_at)
    VALUES 
        -- Wedding project todos
        (project_ids[1], current_user_id, 'Scout Botanical Gardens for best ceremony locations', false, now() - interval '2 days', now() - interval '2 days'),
        (project_ids[1], current_user_id, 'Create detailed shot list for Anderson wedding', false, now() - interval '2 days', now() - interval '2 days'),
        (project_ids[1], current_user_id, 'Coordinate with wedding planner on timeline', false, now() - interval '1 day', now() - interval '1 day'),
        
        (project_ids[2], current_user_id, 'Finalize Davis wedding contract details', false, now() - interval '7 days', now() - interval '1 day'),
        (project_ids[2], current_user_id, 'Schedule engagement session for Davis couple', true, now() - interval '6 days', now() - interval '2 days'),
        (project_ids[2], current_user_id, 'Order additional lighting equipment for September wedding', false, now() - interval '5 days', now() - interval '1 day'),
        
        -- Newborn project todos  
        (project_ids[5], current_user_id, 'Prepare newborn props for Ayşe session', false, now() - interval '1 day', now() - interval '1 day'),
        (project_ids[5], current_user_id, 'Confirm home setup requirements with Sarah', false, now() - interval '1 day', now() - interval '1 day'),
        
        (project_ids[6], current_user_id, 'Set up studio heating for Elif session', false, now() - interval '12 days', now() - interval '3 days'),
        (project_ids[6], current_user_id, 'Prepare custom backdrop for Turner family', false, now() - interval '10 days', now() - interval '3 days'),
        
        -- Corporate project todos
        (project_ids[8], current_user_id, 'Test lighting setup at TechCorp office', false, now() - interval '1 hour', now() - interval '1 hour'),
        (project_ids[8], current_user_id, 'Prepare individual headshot setup guidelines', false, now() - interval '2 hours', now() - interval '2 hours'),
        
        -- Completed project todos
        (project_ids[4], current_user_id, 'Edit Brown wedding ceremony photos', true, now() - interval '40 days', now() - interval '35 days'),
        (project_ids[4], current_user_id, 'Design Brown wedding album layout', true, now() - interval '30 days', now() - interval '25 days'),
        (project_ids[4], current_user_id, 'Deliver final Brown wedding gallery', true, now() - interval '10 days', now() - interval '5 days'),
        
        (project_ids[9], current_user_id, 'Retouch Innovation Labs executive portraits', true, now() - interval '25 days', now() - interval '20 days'),
        (project_ids[9], current_user_id, 'Deliver corporate headshots to HR department', true, now() - interval '15 days', now() - interval '7 days');

    RAISE NOTICE 'Successfully created comprehensive seed data: % leads, % projects, % sessions, % activities, % todos', 
        array_length(lead_ids, 1), array_length(project_ids, 1), 12, 9, 17;

END $$;