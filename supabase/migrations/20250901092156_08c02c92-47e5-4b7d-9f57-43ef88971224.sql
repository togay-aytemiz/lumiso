-- Add more sessions for September and October 2025 with the correct organization ID

-- Get the organization ID and existing data
DO $$
DECLARE
    org_id UUID := '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45';
    user_id UUID := 'ac32273e-af95-4de9-abed-ce96e6f68139';
    lead_ids UUID[];
    project_ids UUID[];
    planned_status_id UUID;
BEGIN
    -- Get some existing lead IDs for the organization
    SELECT ARRAY(
        SELECT id FROM leads 
        WHERE organization_id = org_id 
        LIMIT 8
    ) INTO lead_ids;
    
    -- Get some existing project IDs for the organization  
    SELECT ARRAY(
        SELECT id FROM projects 
        WHERE organization_id = org_id 
        LIMIT 6
    ) INTO project_ids;
    
    -- Get the planned session status ID
    SELECT id INTO planned_status_id 
    FROM session_statuses 
    WHERE organization_id = org_id AND LOWER(name) = 'planned' 
    LIMIT 1;

    -- Add September 2025 sessions
    INSERT INTO sessions (user_id, organization_id, lead_id, project_id, session_date, session_time, status, location, notes) VALUES
    (user_id, org_id, lead_ids[1], project_ids[1], '2025-09-05', '09:00:00', 'planned', 'Central Park Studio', 'Family portrait session - golden hour lighting'),
    (user_id, org_id, lead_ids[2], project_ids[2], '2025-09-08', '14:30:00', 'planned', 'Botanical Gardens', 'Maternity session with natural backdrop'),
    (user_id, org_id, lead_ids[3], project_ids[3], '2025-09-12', '11:00:00', 'planned', 'Downtown Studio', 'Corporate headshots for team of 5'),
    (user_id, org_id, lead_ids[4], project_ids[4], '2025-09-15', '16:00:00', 'planned', 'Beach Location', 'Engagement session at sunset'),
    (user_id, org_id, lead_ids[5], project_ids[5], '2025-09-20', '10:30:00', 'planned', 'Home Studio', 'Newborn session - 2 weeks old'),
    (user_id, org_id, lead_ids[6], project_ids[6], '2025-09-25', '13:00:00', 'planned', 'City Hall', 'Wedding ceremony coverage'),
    (user_id, org_id, lead_ids[7], NULL, '2025-09-28', '15:30:00', 'planned', 'Park Avenue', 'Individual portraits');

    -- Add October 2025 sessions
    INSERT INTO sessions (user_id, organization_id, lead_id, project_id, session_date, session_time, status, location, notes) VALUES
    (user_id, org_id, lead_ids[1], project_ids[1], '2025-10-03', '09:30:00', 'planned', 'Autumn Park', 'Fall family photos with foliage'),
    (user_id, org_id, lead_ids[2], project_ids[2], '2025-10-07', '14:00:00', 'planned', 'Historic District', 'Anniversary session - 25th celebration'),
    (user_id, org_id, lead_ids[3], project_ids[3], '2025-10-12', '11:30:00', 'planned', 'Modern Venue', 'Corporate event photography'),
    (user_id, org_id, lead_ids[4], project_ids[4], '2025-10-18', '16:30:00', 'planned', 'Mountain View', 'Engagement session with scenic views'),
    (user_id, org_id, lead_ids[5], project_ids[5], '2025-10-22', '10:00:00', 'planned', 'Home Setting', 'Baby milestone - 6 months'),
    (user_id, org_id, lead_ids[6], project_ids[6], '2025-10-26', '12:00:00', 'planned', 'Elegant Ballroom', 'Wedding reception coverage'),
    (user_id, org_id, lead_ids[7], NULL, '2025-10-30', '15:00:00', 'planned', 'Urban Setting', 'Halloween-themed family session');

    -- Add September 2025 reminders
    INSERT INTO activities (user_id, organization_id, lead_id, type, content, reminder_date, reminder_time) VALUES
    (user_id, org_id, lead_ids[1], 'reminder', 'Confirm family portrait session details and props needed', '2025-09-04', '10:00:00'),
    (user_id, org_id, lead_ids[2], 'reminder', 'Send maternity session outfit suggestions', '2025-09-07', '09:00:00'),
    (user_id, org_id, lead_ids[3], 'reminder', 'Set up lighting equipment for corporate headshots', '2025-09-11', '16:00:00'),
    (user_id, org_id, lead_ids[4], 'reminder', 'Check sunset timing for engagement session', '2025-09-14', '11:00:00'),
    (user_id, org_id, lead_ids[5], 'reminder', 'Prepare newborn props and heating equipment', '2025-09-19', '09:30:00'),
    (user_id, org_id, lead_ids[6], 'reminder', 'Coordinate with wedding planner for ceremony schedule', '2025-09-24', '14:00:00'),
    (user_id, org_id, lead_ids[7], 'reminder', 'Review portrait style preferences with client', '2025-09-27', '13:00:00');

    -- Add October 2025 reminders  
    INSERT INTO activities (user_id, organization_id, lead_id, type, content, reminder_date, reminder_time) VALUES
    (user_id, org_id, lead_ids[1], 'reminder', 'Scout autumn foliage locations for family session', '2025-10-02', '08:00:00'),
    (user_id, org_id, lead_ids[2], 'reminder', 'Plan anniversary session timeline and poses', '2025-10-06', '15:00:00'),
    (user_id, org_id, lead_ids[3], 'reminder', 'Confirm corporate event coverage requirements', '2025-10-11', '10:30:00'),
    (user_id, org_id, lead_ids[4], 'reminder', 'Check weather forecast for mountain engagement session', '2025-10-17', '12:00:00'),
    (user_id, org_id, lead_ids[5], 'reminder', 'Prepare baby milestone props and backup outfits', '2025-10-21', '09:00:00'),
    (user_id, org_id, lead_ids[6], 'reminder', 'Review wedding reception shot list with couple', '2025-10-25', '16:00:00'),
    (user_id, org_id, lead_ids[7], 'reminder', 'Gather Halloween props for themed family session', '2025-10-29', '14:00:00');

END $$;