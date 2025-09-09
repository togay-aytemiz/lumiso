-- Fix security warnings - set search_path on remaining functions that need it

-- Fix function search path issues
CREATE OR REPLACE FUNCTION public.ensure_default_email_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only create default email channel for active templates
  IF NEW.is_active = true THEN
    -- Check if there's already an email channel view
    IF NOT EXISTS (
      SELECT 1 FROM public.template_channel_views 
      WHERE template_id = NEW.id AND channel = 'email'
    ) THEN
      -- Create default email channel view
      INSERT INTO public.template_channel_views (template_id, channel, subject, content)
      VALUES (
        NEW.id, 
        'email',
        COALESCE(NEW.master_subject, NEW.name, 'Subject'),
        COALESCE(NEW.master_content, '')
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_lead_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, new_values)
    VALUES (COALESCE(auth.uid(), NEW.user_id), 'lead', NEW.id, 'created', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD IS DISTINCT FROM NEW THEN
      INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, old_values, new_values)
      VALUES (COALESCE(auth.uid(), NEW.user_id), 'lead', NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, old_values)
    VALUES (COALESCE(auth.uid(), OLD.user_id), 'lead', OLD.id, 'deleted', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_session_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, new_values)
    VALUES (NEW.user_id, 'session', NEW.id, 'created', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD IS DISTINCT FROM NEW THEN
      INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, old_values, new_values)
      VALUES (NEW.user_id, 'session', NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, old_values)
    VALUES (OLD.user_id, 'session', OLD.id, 'deleted', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create a cron job to automatically clean up workflow executions daily
SELECT cron.schedule(
  'cleanup-workflow-executions',
  '0 2 * * *', -- Run at 2 AM daily
  $$
  SELECT public.cleanup_workflow_executions();
  $$
);