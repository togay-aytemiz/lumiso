-- Add template_slug to activities so seeded notes/reminders can be tagged and cleaned up safely.
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS template_slug text;

-- Optional index for quick lookups by template (e.g., deleting seeded rows).
CREATE INDEX IF NOT EXISTS idx_activities_template_slug
ON public.activities(template_slug)
WHERE template_slug IS NOT NULL;
