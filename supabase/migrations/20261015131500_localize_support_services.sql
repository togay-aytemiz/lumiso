-- Localize service category and names for the Sweet Dreams demo org (support@lumiso.app).
-- Idempotent: updates only, keyed by org and template slugs/categories.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  target_email CONSTANT text := 'support@lumiso.app';
  target_org_name CONSTANT text := 'Sweet Dreams Photography';
  org_id uuid;
BEGIN
  -- Find the org by owner email; fall back to name.
  SELECT o.id
  INTO org_id
  FROM public.organizations o
  JOIN auth.users u ON u.id = o.owner_id
  WHERE u.email = target_email
  ORDER BY o.created_at DESC
  LIMIT 1;

  IF org_id IS NULL THEN
    SELECT id INTO org_id
    FROM public.organizations
    WHERE name = target_org_name
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF org_id IS NULL THEN
    RAISE NOTICE 'Demo org not found; skipping localization.';
    RETURN;
  END IF;

  -- Translate common service categories to Turkish for this org.
  UPDATE public.services
  SET category = CASE category
    WHEN 'Albums' THEN 'Albümler'
    WHEN 'Album' THEN 'Albümler'
    WHEN 'Extras' THEN 'Ekstralar'
    WHEN 'Prints' THEN 'Baskılar'
    WHEN 'Retouching' THEN 'Rötuş'
    WHEN 'Team' THEN 'Ekip'
    WHEN 'Coverage' THEN 'Çekim Kapsamı'
    ELSE category
  END
  WHERE organization_id = org_id;

  -- Translate common default service names.
  UPDATE public.services
  SET name = 'Baş Fotoğrafçı'
  WHERE organization_id = org_id
    AND template_slug IN ('lead_photographer');

  UPDATE public.services
  SET name = 'Asistan Fotoğrafçı'
  WHERE organization_id = org_id
    AND template_slug IN ('assistant_photographer');

  UPDATE public.services
  SET name = 'Drone Operatörü'
  WHERE organization_id = org_id
    AND template_slug IN ('drone_operator');

  UPDATE public.services
  SET name = 'Albüm'
  WHERE organization_id = org_id
    AND template_slug IN ('album_standard','album_premium','album');

  UPDATE public.services
  SET name = 'Baskı'
  WHERE organization_id = org_id
    AND template_slug IN ('print_standard','print');

  UPDATE public.services
  SET name = 'Rötuş'
  WHERE organization_id = org_id
    AND template_slug IN ('retouching_basic','retouch');

  UPDATE public.services
  SET name = 'Ekstra Hizmet'
  WHERE organization_id = org_id
    AND template_slug IN ('extra','extras');
END;
$$;
