-- Fix security warnings by ensuring all functions have proper search_path settings

-- Fix function search path for existing functions that don't have it set
CREATE OR REPLACE FUNCTION public.update_email_templates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_template_image_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.template_image_usage (organization_id, user_id, total_images, total_storage_bytes)
    VALUES (NEW.organization_id, NEW.user_id, 1, NEW.file_size)
    ON CONFLICT (organization_id) 
    DO UPDATE SET 
      total_images = template_image_usage.total_images + 1,
      total_storage_bytes = template_image_usage.total_storage_bytes + NEW.file_size,
      updated_at = now();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.template_image_usage 
    SET 
      total_images = GREATEST(0, total_images - 1),
      total_storage_bytes = GREATEST(0, total_storage_bytes - OLD.file_size),
      updated_at = now()
    WHERE organization_id = OLD.organization_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_invitation_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Just log the invitation creation, don't create pending memberships
  -- The membership will be created when the user accepts the invitation
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_activity_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, new_values)
    VALUES (NEW.user_id, 'activity', NEW.id, 'created', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD IS DISTINCT FROM NEW THEN
      INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, old_values, new_values)
      VALUES (NEW.user_id, 'activity', NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, old_values)
    VALUES (OLD.user_id, 'activity', OLD.id, 'deleted', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Move pg_net extension to extensions schema for better security
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;