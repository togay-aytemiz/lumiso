-- Sync existing lead status data to field values for better consistency
INSERT INTO public.lead_field_values (lead_id, field_key, value)
SELECT 
  l.id,
  'status',
  ls.name
FROM public.leads l
JOIN public.lead_statuses ls ON l.status_id = ls.id  
WHERE NOT EXISTS (
  SELECT 1 FROM public.lead_field_values lfv 
  WHERE lfv.lead_id = l.id AND lfv.field_key = 'status'
);

-- Make sure all organizations have their status fields synced
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN 
    SELECT id FROM public.organizations
  LOOP
    PERFORM public.ensure_lead_status_field(org_record.id);
  END LOOP;
END
$$;