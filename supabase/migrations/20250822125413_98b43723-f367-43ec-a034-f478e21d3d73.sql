-- Fix the duplication issue by improving the trigger logic
-- First, let's modify the trigger to avoid duplicates and be more precise

CREATE OR REPLACE FUNCTION public.log_lead_field_value_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  field_definition_record RECORD;
  lead_record RECORD;
  auth_user_id UUID;
BEGIN
  -- Get current authenticated user
  auth_user_id := auth.uid();
  
  -- Get the field definition for the label
  SELECT label, field_type INTO field_definition_record
  FROM public.lead_field_definitions lfd
  JOIN public.leads l ON l.organization_id = lfd.organization_id
  WHERE lfd.field_key = COALESCE(NEW.field_key, OLD.field_key)
  AND l.id = COALESCE(NEW.lead_id, OLD.lead_id)
  LIMIT 1;
  
  -- Get lead info for user_id (fallback)
  SELECT user_id INTO lead_record
  FROM public.leads
  WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);
  
  -- Only log if we actually have a value change (not just upsert operations)
  IF TG_OP = 'INSERT' THEN
    -- Only log if there's actually a value (not empty inserts)
    IF NEW.value IS NOT NULL AND NEW.value != '' THEN
      INSERT INTO public.audit_log (
        user_id, 
        entity_type, 
        entity_id, 
        action, 
        new_values
      )
      VALUES (
        COALESCE(auth_user_id, lead_record.user_id),
        'lead_field_value',
        NEW.lead_id,
        'created',
        jsonb_build_object(
          'field_key', NEW.field_key,
          'field_label', COALESCE(field_definition_record.label, NEW.field_key),
          'field_type', COALESCE(field_definition_record.field_type, 'text'),
          'value', NEW.value
        )
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log if the value actually changed
    IF OLD.value IS DISTINCT FROM NEW.value THEN
      INSERT INTO public.audit_log (
        user_id,
        entity_type,
        entity_id,
        action,
        old_values,
        new_values
      )
      VALUES (
        COALESCE(auth_user_id, lead_record.user_id),
        'lead_field_value',
        NEW.lead_id,
        'updated',
        jsonb_build_object(
          'field_key', OLD.field_key,
          'field_label', COALESCE(field_definition_record.label, OLD.field_key),
          'field_type', COALESCE(field_definition_record.field_type, 'text'),
          'value', OLD.value
        ),
        jsonb_build_object(
          'field_key', NEW.field_key,
          'field_label', COALESCE(field_definition_record.label, NEW.field_key),
          'field_type', COALESCE(field_definition_record.field_type, 'text'),
          'value', NEW.value
        )
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (
      user_id,
      entity_type,
      entity_id,
      action,
      old_values
    )
    VALUES (
      COALESCE(auth_user_id, lead_record.user_id),
      'lead_field_value',
      OLD.lead_id,
      'deleted',
      jsonb_build_object(
        'field_key', OLD.field_key,
        'field_label', COALESCE(field_definition_record.label, OLD.field_key),
        'field_type', COALESCE(field_definition_record.field_type, 'text'),
        'value', OLD.value
      )
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Also let's clean up any duplicate entries that might exist
-- Delete duplicate audit log entries for lead_field_value (keeping the most recent one)
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY entity_type, entity_id, action, 
           COALESCE(old_values, '{}'), COALESCE(new_values, '{}')
           ORDER BY created_at DESC
         ) as rn
  FROM audit_log 
  WHERE entity_type = 'lead_field_value'
  AND created_at > NOW() - INTERVAL '1 hour'  -- Only clean recent duplicates
)
DELETE FROM audit_log 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);