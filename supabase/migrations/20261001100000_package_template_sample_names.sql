-- Refresh default package templates to use generic sample names and keep them applicable to all project types.

-- English labels
UPDATE public.default_package_templates
SET
  name = 'Sample Package 1',
  description = 'Sample package for new accounts.',
  applicable_type_labels = ARRAY[]::text[]
WHERE slug = 'wedding_story'
  AND locale = 'en';

UPDATE public.default_package_templates
SET
  name = 'Sample Package 2',
  description = 'Second sample package for new accounts.',
  applicable_type_labels = ARRAY[]::text[]
WHERE slug = 'mini_lifestyle'
  AND locale = 'en';

-- Turkish labels
UPDATE public.default_package_templates
SET
  name = 'Örnek paket 1',
  description = 'Yeni hesaplar için örnek paket.',
  applicable_type_labels = ARRAY[]::text[]
WHERE slug = 'wedding_story'
  AND locale = 'tr';

UPDATE public.default_package_templates
SET
  name = 'Örnek paket 2',
  description = 'Yeni hesaplar için ikinci örnek paket.',
  applicable_type_labels = ARRAY[]::text[]
WHERE slug = 'mini_lifestyle'
  AND locale = 'tr';
