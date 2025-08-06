-- Update leads to use status_id instead of status text
-- First, update existing leads to set status_id based on current status text

-- Update leads with status_id based on matching status names
UPDATE public.leads 
SET status_id = (
  SELECT ls.id 
  FROM public.lead_statuses ls 
  WHERE ls.user_id = leads.user_id 
  AND LOWER(ls.name) = LOWER(leads.status)
  LIMIT 1
)
WHERE status_id IS NULL AND status IS NOT NULL;

-- For any remaining leads without status_id, set to default status
UPDATE public.leads 
SET status_id = public.get_default_lead_status(user_id)
WHERE status_id IS NULL;