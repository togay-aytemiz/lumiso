-- Fix existing user account by creating organization and setting up membership

DO $$
DECLARE
    existing_user_id UUID := 'ac32273e-af95-4de9-abed-ce96e6f68139';
    new_org_id UUID;
BEGIN
    -- Create organization for existing user
    INSERT INTO public.organizations (owner_id, name)
    VALUES (existing_user_id, 'My Organization')
    RETURNING id INTO new_org_id;
    
    -- Create organization membership as Owner
    INSERT INTO public.organization_members (organization_id, user_id, system_role, role, status)
    VALUES (new_org_id, existing_user_id, 'Owner', 'Owner', 'active');
    
    -- Ensure user settings exist and set active organization
    INSERT INTO public.user_settings (
        user_id, 
        active_organization_id,
        show_quick_status_buttons,
        photography_business_name,
        logo_url,
        primary_brand_color,
        date_format,
        time_format,
        notification_global_enabled,
        notification_daily_summary_enabled,
        notification_weekly_recap_enabled,
        notification_new_assignment_enabled,
        notification_project_milestone_enabled,
        notification_scheduled_time
    ) VALUES (
        existing_user_id,
        new_org_id,
        true,
        '',
        null,
        '#1EB29F',
        'DD/MM/YYYY',
        '12-hour',
        true,
        true,
        true,
        true,
        true,
        '09:00'
    ) ON CONFLICT (user_id) DO UPDATE SET
        active_organization_id = new_org_id;
    
    -- Create default working hours
    INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
    VALUES 
        (existing_user_id, 1, true, '09:00', '17:00'), -- Monday
        (existing_user_id, 2, true, '09:00', '17:00'), -- Tuesday
        (existing_user_id, 3, true, '09:00', '17:00'), -- Wednesday
        (existing_user_id, 4, true, '09:00', '17:00'), -- Thursday
        (existing_user_id, 5, true, '09:00', '17:00'), -- Friday
        (existing_user_id, 6, false, '09:00', '17:00'), -- Saturday
        (existing_user_id, 0, false, '09:00', '17:00'); -- Sunday

    -- Create all default data for this organization
    PERFORM public.ensure_default_packages_for_org(existing_user_id, new_org_id);
    PERFORM public.ensure_default_project_types_for_org(existing_user_id, new_org_id);
    PERFORM public.ensure_default_lead_statuses_for_org(existing_user_id, new_org_id);
    PERFORM public.ensure_default_project_statuses_for_org(existing_user_id, new_org_id);
    PERFORM public.ensure_default_session_statuses(existing_user_id);
    
END $$;