-- Create organization and membership for the user who doesn't have any (fixed)
DO $$
DECLARE
    user_uuid UUID := 'ac32273e-af95-4de9-abed-ce96e6f68139';
    org_id UUID;
BEGIN
    -- Check if user already has an organization
    SELECT o.id INTO org_id
    FROM organizations o
    WHERE o.owner_id = user_uuid
    LIMIT 1;
    
    -- If no organization exists, create one
    IF org_id IS NULL THEN
        INSERT INTO organizations (owner_id, name)
        VALUES (user_uuid, 'My Organization')
        RETURNING id INTO org_id;
        
        RAISE NOTICE 'Created organization % for user %', org_id, user_uuid;
    END IF;
    
    -- Create organization membership as Owner with proper role field
    INSERT INTO organization_members (organization_id, user_id, system_role, role, status)
    VALUES (org_id, user_uuid, 'Owner', 'Owner', 'active')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
    
    -- Set active organization in user settings
    UPDATE user_settings 
    SET active_organization_id = org_id 
    WHERE user_id = user_uuid;
    
    RAISE NOTICE 'Set active organization % for user %', org_id, user_uuid;
END $$;