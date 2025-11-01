-- Add foreign key constraint between sessions and leads tables
ALTER TABLE public.sessions 
ADD CONSTRAINT sessions_lead_id_fkey 
FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;