-- Ensure default template subjects use localized variable labels and update legacy rows

CREATE TEMP TABLE subject_defs (
  slug text,
  locale text,
  subject_text text,
  legacy_subjects text[]
);

INSERT INTO subject_defs (slug, locale, subject_text, legacy_subjects)
VALUES
  (
    'session_confirmation',
    'en',
    'Your session is booked for {session_date|Session Date}',
    ARRAY[
      'Your session is booked for {{session_date}}',
      'Your session is booked for {session_date}'
    ]
  ),
  (
    'session_reminder',
    'en',
    'Reminder: session on {session_date|Session Date}',
    ARRAY[
      'Reminder: session on {{session_date}}',
      'Reminder: session on {session_date}'
    ]
  ),
  (
    'session_confirmation',
    'tr',
    '{session_date|Seans Tarihi} tarihli çekiminiz onaylandı',
    ARRAY[
      '{{session_date}} tarihli çekiminiz onaylandı',
      '{session_date} tarihli çekiminiz onaylandı'
    ]
  ),
  (
    'session_reminder',
    'tr',
    '{session_date|Seans Tarihi} tarihli çekiminiz yaklaşıyor',
    ARRAY[
      '{{session_date}} tarihli çekiminiz yaklaşıyor',
      '{session_date} tarihli çekiminiz yaklaşıyor'
    ]
  );

-- Update default template catalog
UPDATE public.default_message_template_templates AS dst
SET subject = defs.subject_text
FROM subject_defs AS defs
WHERE dst.slug = defs.slug
  AND dst.locale = defs.locale;

-- Update seeded message templates still using the legacy subject formats
UPDATE public.message_templates AS mt
SET master_subject = defs.subject_text
FROM subject_defs AS defs
WHERE mt.template_slug = defs.slug
  AND defs.locale = split_part(COALESCE(public.get_org_locale(mt.organization_id), 'tr'), '-', 1)
  AND (
    mt.master_subject = ANY(defs.legacy_subjects)
    OR mt.master_subject LIKE '%{{%'
  );

DROP TABLE IF EXISTS subject_defs;
