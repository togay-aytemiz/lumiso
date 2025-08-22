-- First, let's ensure we have proper audit logging for lead field values
-- Create a trigger function to log custom field changes
CREATE OR REPLACE FUNCTION public.log_lead_field_value_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  field_definition_record RECORD;
  lead_record RECORD;
BEGIN
  -- Get the field definition for the label
  SELECT label, field_type INTO field_definition_record
  FROM public.lead_field_definitions lfd
  JOIN public.leads l ON l.organization_id = lfd.organization_id
  WHERE lfd.field_key = COALESCE(NEW.field_key, OLD.field_key)
  AND l.id = COALESCE(NEW.lead_id, OLD.lead_id)
  LIMIT 1;
  
  -- Get lead info for user_id
  SELECT user_id INTO lead_record
  FROM public.leads
  WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);
  
  -- Insert audit log entry with custom field information
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (
      user_id, 
      entity_type, 
      entity_id, 
      action, 
      new_values
    )
    VALUES (
      lead_record.user_id,
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
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (
      user_id,
      entity_type,
      entity_id,
      action,
      old_values,
      new_values
    )
    VALUES (
      lead_record.user_id,
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
      lead_record.user_id,
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

-- Create the trigger on lead_field_values table
DROP TRIGGER IF EXISTS lead_field_value_changes_trigger ON public.lead_field_values;
CREATE TRIGGER lead_field_value_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.lead_field_values
    FOR EACH ROW EXECUTE FUNCTION public.log_lead_field_value_changes();

-- Also ensure we capture the user who made the change in audit_log
-- Update the existing lead changes trigger to capture auth.uid()
CREATE OR REPLACE FUNCTION public.log_lead_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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