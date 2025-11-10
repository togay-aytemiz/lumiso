-- Allow the same catalog service to be attached to a project once per billing type.
alter table public.project_services
drop constraint if exists project_services_project_id_service_id_key;

alter table public.project_services
add constraint project_services_project_id_service_id_billing_type_key
unique (project_id, service_id, billing_type);
