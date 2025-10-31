-- Services catalog refinements: introduce service_type classification and metadata
alter table public.services
  add column if not exists service_type text not null default 'deliverable';

alter table public.services
  add column if not exists is_people_based boolean not null default false;

alter table public.services
  add column if not exists default_unit text;

alter table public.services
  drop constraint if exists services_service_type_check;

alter table public.services
  add constraint services_service_type_check
    check (service_type in ('coverage', 'deliverable'));

comment on column public.services.service_type is 'Indicates whether the service is coverage (people/staff) or deliverable (product/post-production).';

comment on column public.services.is_people_based is 'Flags services that require staffing resources (second shooter, assistant, etc.).';

comment on column public.services.default_unit is 'Optional unit label displayed when selecting the service (e.g. hour, album, print pack).';
