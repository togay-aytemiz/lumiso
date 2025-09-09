-- Migration: Move existing email templates to message templates with channel views

DO $$
DECLARE
    email_template RECORD;
    new_template_id UUID;
    placeholder_list TEXT[];
    content_text TEXT;
    html_content TEXT;
BEGIN
    -- Loop through all email templates
    FOR email_template IN 
        SELECT * FROM email_templates WHERE status = 'published'
    LOOP
        -- Generate new UUID for message template
        new_template_id := gen_random_uuid();
        
        -- Extract content from blocks (simplified - just concatenate text blocks)
        content_text := COALESCE(email_template.subject, '');
        html_content := '';
        
        -- Simple placeholder extraction (look for {variable} patterns)
        placeholder_list := regexp_split_to_array(
            regexp_replace(
                COALESCE(email_template.subject, '') || ' ' || COALESCE(email_template.preheader, ''),
                '.*?{([^}]+)}.*?', '\1,', 'g'
            ),
            ','
        );
        
        -- Clean up empty elements
        placeholder_list := ARRAY(SELECT unnest(placeholder_list) WHERE trim(unnest(placeholder_list)) != '');
        
        -- Insert into message_templates
        INSERT INTO message_templates (
            id,
            organization_id,
            user_id,
            name,
            category,
            master_content,
            master_subject,
            placeholders,
            is_active
        ) VALUES (
            new_template_id,
            email_template.organization_id,
            email_template.user_id,
            email_template.name,
            CASE 
                WHEN LOWER(email_template.name) LIKE '%session%scheduled%' THEN 'session_scheduled'
                WHEN LOWER(email_template.name) LIKE '%session%reminder%' THEN 'session_reminder'
                WHEN LOWER(email_template.name) LIKE '%session%rescheduled%' THEN 'session_rescheduled'
                WHEN LOWER(email_template.name) LIKE '%session%cancelled%' THEN 'session_cancelled'
                WHEN LOWER(email_template.name) LIKE '%session%completed%' THEN 'session_completed'
                ELSE COALESCE(email_template.category, 'general')
            END,
            COALESCE(email_template.subject, email_template.name),
            email_template.subject,
            placeholder_list::jsonb,
            true
        );
        
        -- Create email channel view
        INSERT INTO template_channel_views (
            template_id,
            channel,
            subject,
            content,
            html_content
        ) VALUES (
            new_template_id,
            'email',
            email_template.subject,
            COALESCE(email_template.subject, email_template.name),
            '<p>' || COALESCE(email_template.subject, email_template.name) || '</p>' ||
            CASE WHEN email_template.preheader IS NOT NULL THEN '<p><em>' || email_template.preheader || '</em></p>' ELSE '' END
        );
        
        RAISE NOTICE 'Migrated email template: % to message template: %', email_template.name, new_template_id;
    END LOOP;
    
    RAISE NOTICE 'Migration completed successfully';
END $$;