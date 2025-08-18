-- Fix user's organization setup by setting their active organization
DO $$
DECLARE
    user_record RECORD;
    org_record RECORD;
BEGIN
    -- Find users who don't have an active organization but are organization owners
    FOR user_record IN 
        SELECT DISTINCT om.user_id, om.organization_id
        FROM organization_members om
        LEFT JOIN user_settings us ON om.user_id = us.user_id
        WHERE om.system_role = 'Owner' 
        AND om.status = 'active'
        AND (us.active_organization_id IS NULL OR us.active_organization_id != om.organization_id)
    LOOP
        -- Update or create user settings with the correct active organization
        INSERT INTO user_settings (user_id, active_organization_id)
        VALUES (user_record.user_id, user_record.organization_id)
        ON CONFLICT (user_id) 
        DO UPDATE SET active_organization_id = user_record.organization_id
        WHERE user_settings.active_organization_id IS NULL;
        
        RAISE NOTICE 'Updated active organization for user %', user_record.user_id;
    END LOOP;
END $$;