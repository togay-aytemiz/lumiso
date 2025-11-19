-- Ensure TR organizations that already seeded defaults get localized project/session labels

-- Update project type names from English to Turkish when template + locale match
WITH tr_orgs AS (
  SELECT organization_id
  FROM public.organization_settings
  WHERE public.normalize_locale_code(preferred_locale, 'tr') = 'tr'
),
english_defaults AS (
  SELECT slug, name AS en_name
  FROM public.default_project_type_templates
  WHERE locale = 'en'
)
UPDATE public.project_types AS pt
SET name = tr_defaults.name
FROM tr_orgs,
     public.default_project_type_templates AS tr_defaults,
     english_defaults AS en_defaults
WHERE tr_defaults.slug = pt.template_slug
  AND tr_defaults.locale = 'tr'
  AND en_defaults.slug = pt.template_slug
  AND pt.organization_id = tr_orgs.organization_id
  AND pt.template_slug IS NOT NULL
  AND pt.name = en_defaults.en_name;

-- Update session type labels/descriptions for Turkish orgs that still have English defaults
WITH tr_orgs AS (
  SELECT organization_id
  FROM public.organization_settings
  WHERE public.normalize_locale_code(preferred_locale, 'tr') = 'tr'
),
english_session_defaults AS (
  SELECT slug, name AS en_name
  FROM public.default_session_type_templates
  WHERE locale = 'en'
)
UPDATE public.session_types AS st
SET name = tr_defaults.name,
    description = tr_defaults.description,
    duration_minutes = tr_defaults.duration_minutes,
    category = tr_defaults.category
FROM tr_orgs,
     public.default_session_type_templates AS tr_defaults,
     english_session_defaults AS en_defaults
WHERE tr_defaults.slug = st.template_slug
  AND tr_defaults.locale = 'tr'
  AND en_defaults.slug = st.template_slug
  AND st.organization_id = tr_orgs.organization_id
  AND st.template_slug IS NOT NULL
  AND st.name = en_defaults.en_name;
