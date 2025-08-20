-- Remove the "Not Interested" lead status from existing organizations
DELETE FROM public.lead_statuses 
WHERE LOWER(name) = 'not interested' 
AND lifecycle = 'active';