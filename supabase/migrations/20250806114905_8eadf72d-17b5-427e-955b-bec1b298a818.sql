-- Add foreign key constraint between leads.status_id and lead_statuses.id
ALTER TABLE public.leads 
ADD CONSTRAINT fk_leads_status_id 
FOREIGN KEY (status_id) 
REFERENCES public.lead_statuses(id) 
ON DELETE SET NULL;