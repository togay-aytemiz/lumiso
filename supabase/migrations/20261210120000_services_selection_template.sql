-- Add optional selection template to services for deliverable photo selection rules
alter table public.services
  add column if not exists selection_template jsonb null;

comment on column public.services.selection_template is
  'Optional jsonb array of selection rules for deliverable services (e.g., {part, min, max, required, notes}). Empty/null keeps legacy behavior.';
