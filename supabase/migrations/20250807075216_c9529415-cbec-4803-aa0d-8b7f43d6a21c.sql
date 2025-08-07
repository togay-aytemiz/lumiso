-- One-time cleanup function to remove duplicate system statuses
-- Ensures each user has exactly one green (#22c55e) and one red (#ef4444) system status

CREATE OR REPLACE FUNCTION public.cleanup_duplicate_system_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  user_record RECORD;
  green_statuses RECORD;
  red_statuses RECORD;
  status_to_delete RECORD;
BEGIN
  -- Loop through all users who have system statuses
  FOR user_record IN 
    SELECT DISTINCT user_id 
    FROM public.lead_statuses 
    WHERE is_system_final = true
  LOOP
    -- Handle green/completed statuses (#22c55e)
    -- Keep only the oldest one, delete the rest
    FOR status_to_delete IN
      SELECT id, name, created_at
      FROM public.lead_statuses 
      WHERE user_id = user_record.user_id 
        AND is_system_final = true 
        AND color = '#22c55e'
      ORDER BY created_at ASC, name ASC
      OFFSET 1  -- Skip the first (oldest) one, delete the rest
    LOOP
      -- Log what we're deleting
      RAISE NOTICE 'Deleting duplicate green system status for user %: % (created: %)', 
        user_record.user_id, status_to_delete.name, status_to_delete.created_at;
      
      -- Check if any leads are using this status before deleting
      UPDATE public.leads 
      SET status_id = (
        SELECT id 
        FROM public.lead_statuses 
        WHERE user_id = user_record.user_id 
          AND is_system_final = true 
          AND color = '#22c55e'
        ORDER BY created_at ASC, name ASC
        LIMIT 1
      )
      WHERE status_id = status_to_delete.id;
      
      -- Delete the duplicate status
      DELETE FROM public.lead_statuses 
      WHERE id = status_to_delete.id;
    END LOOP;

    -- Handle red/lost statuses (#ef4444)
    -- Keep only the oldest one, delete the rest
    FOR status_to_delete IN
      SELECT id, name, created_at
      FROM public.lead_statuses 
      WHERE user_id = user_record.user_id 
        AND is_system_final = true 
        AND color = '#ef4444'
      ORDER BY created_at ASC, name ASC
      OFFSET 1  -- Skip the first (oldest) one, delete the rest
    LOOP
      -- Log what we're deleting
      RAISE NOTICE 'Deleting duplicate red system status for user %: % (created: %)', 
        user_record.user_id, status_to_delete.name, status_to_delete.created_at;
      
      -- Check if any leads are using this status before deleting
      UPDATE public.leads 
      SET status_id = (
        SELECT id 
        FROM public.lead_statuses 
        WHERE user_id = user_record.user_id 
          AND is_system_final = true 
          AND color = '#ef4444'
        ORDER BY created_at ASC, name ASC
        LIMIT 1
      )
      WHERE status_id = status_to_delete.id;
      
      -- Delete the duplicate status
      DELETE FROM public.lead_statuses 
      WHERE id = status_to_delete.id;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Cleanup completed successfully';
END;
$function$;

-- Run the cleanup function once
SELECT public.cleanup_duplicate_system_statuses();

-- Drop the cleanup function after use (optional, for security)
DROP FUNCTION IF EXISTS public.cleanup_duplicate_system_statuses();