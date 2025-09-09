-- Create table for scheduled session reminders
CREATE TABLE IF NOT EXISTS public.scheduled_session_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    session_id UUID NOT NULL,
    workflow_id UUID NOT NULL,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('1_day', '3_days', '1_week', '1_hour', 'same_day')),
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    UNIQUE(session_id, workflow_id, reminder_type)
);

-- Enable RLS
ALTER TABLE public.scheduled_session_reminders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Organization members can view scheduled reminders"
ON public.scheduled_session_reminders FOR SELECT
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "System can manage scheduled reminders"
ON public.scheduled_session_reminders FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_scheduled_session_reminders_organization_id ON public.scheduled_session_reminders(organization_id);
CREATE INDEX idx_scheduled_session_reminders_session_id ON public.scheduled_session_reminders(session_id);
CREATE INDEX idx_scheduled_session_reminders_scheduled_for ON public.scheduled_session_reminders(scheduled_for);
CREATE INDEX idx_scheduled_session_reminders_status ON public.scheduled_session_reminders(status);
CREATE INDEX idx_scheduled_session_reminders_pending ON public.scheduled_session_reminders(status, scheduled_for) WHERE status = 'pending';

-- Create function to schedule session reminders
CREATE OR REPLACE FUNCTION public.schedule_session_reminders(session_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    session_record RECORD;
    workflow_record RECORD;
    reminder_time TIMESTAMP WITH TIME ZONE;
    reminder_type TEXT;
    delay_minutes INTEGER;
BEGIN
    -- Get session details
    SELECT s.*, EXTRACT(EPOCH FROM (s.session_date + s.session_time - NOW()))/60 as minutes_until_session
    INTO session_record
    FROM public.sessions s
    WHERE s.id = session_id_param;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Only schedule reminders for future sessions
    IF session_record.minutes_until_session <= 0 THEN
        RETURN;
    END IF;
    
    -- Find active session reminder workflows for this organization
    FOR workflow_record IN
        SELECT w.*, ws.delay_minutes
        FROM public.workflows w
        JOIN public.workflow_steps ws ON w.id = ws.workflow_id
        WHERE w.organization_id = session_record.organization_id
        AND w.trigger_type = 'session_reminder'
        AND w.is_active = true
        AND ws.is_active = true
        ORDER BY ws.step_order
    LOOP
        delay_minutes := workflow_record.delay_minutes;
        
        -- Determine reminder type based on delay
        CASE 
            WHEN delay_minutes = 1440 THEN reminder_type := '1_day';
            WHEN delay_minutes = 4320 THEN reminder_type := '3_days'; 
            WHEN delay_minutes = 10080 THEN reminder_type := '1_week';
            WHEN delay_minutes = 60 THEN reminder_type := '1_hour';
            WHEN delay_minutes = 480 THEN reminder_type := 'same_day';
            ELSE CONTINUE; -- Skip unsupported delays
        END CASE;
        
        -- Calculate when to send the reminder
        reminder_time := (session_record.session_date + session_record.session_time) - INTERVAL '1 minute' * delay_minutes;
        
        -- Only schedule if reminder time is in the future
        IF reminder_time > NOW() THEN
            -- Insert or update scheduled reminder
            INSERT INTO public.scheduled_session_reminders (
                organization_id,
                session_id,
                workflow_id,
                reminder_type,
                scheduled_for
            )
            VALUES (
                session_record.organization_id,
                session_id_param,
                workflow_record.id,
                reminder_type,
                reminder_time
            )
            ON CONFLICT (session_id, workflow_id, reminder_type) 
            DO UPDATE SET
                scheduled_for = EXCLUDED.scheduled_for,
                status = 'pending',
                processed_at = NULL,
                error_message = NULL;
        END IF;
    END LOOP;
END;
$$;

-- Create function to clean up old reminders
CREATE OR REPLACE FUNCTION public.cleanup_old_session_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete reminders older than 30 days that are completed or failed
    DELETE FROM public.scheduled_session_reminders 
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND status IN ('sent', 'failed', 'cancelled');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;