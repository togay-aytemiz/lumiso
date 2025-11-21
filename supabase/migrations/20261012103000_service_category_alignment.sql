-- Align default service seed categories with the default UI buckets
WITH canonical_categories AS (
  VALUES
    ('lead_photographer', 'Lead Photographer'),
    ('assistant_photographer', 'Assistant Photographer'),
    ('signature_album', 'Albums'),
    ('drone_addon', 'Drone Operator')
)
UPDATE public.default_service_templates dst
SET category = c.canonical_category
FROM canonical_categories AS c(slug, canonical_category)
WHERE dst.slug = c.slug;

-- Backfill already-seeded services that still carry the older Crew/Deliverables buckets
WITH canonical_categories AS (
  VALUES
    ('lead_photographer', 'Lead Photographer'),
    ('assistant_photographer', 'Assistant Photographer'),
    ('signature_album', 'Albums'),
    ('drone_addon', 'Drone Operator')
)
UPDATE public.services AS svc
SET category = c.canonical_category
FROM canonical_categories AS c(slug, canonical_category)
WHERE svc.template_slug = c.slug
  AND (
    lower(coalesce(svc.category, '')) IN ('crew', 'deliverables', 'ekip', 'teslimatlar')
    OR svc.category IS NULL
  );
