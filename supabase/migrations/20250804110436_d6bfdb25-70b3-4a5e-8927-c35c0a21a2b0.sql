-- Add foreign key constraints to project_services table
ALTER TABLE public.project_services 
ADD CONSTRAINT fk_project_services_project_id 
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.project_services 
ADD CONSTRAINT fk_project_services_service_id 
FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;