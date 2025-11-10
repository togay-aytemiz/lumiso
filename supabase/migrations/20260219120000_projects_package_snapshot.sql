-- Add fields for tracking the selected package on each project.
alter table public.projects
  add column if not exists package_id uuid references public.packages (id);

alter table public.projects
  add column if not exists package_snapshot jsonb;

create index if not exists idx_projects_package_id on public.projects (package_id);
