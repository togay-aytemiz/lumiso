-- Template tables for project/session/lead stages with locale-aware seeding

ALTER TABLE public.project_statuses
  ADD COLUMN IF NOT EXISTS template_slug text;

ALTER TABLE public.session_statuses
  ADD COLUMN IF NOT EXISTS template_slug text;

ALTER TABLE public.lead_statuses
  ADD COLUMN IF NOT EXISTS template_slug text;

CREATE TABLE IF NOT EXISTS public.default_project_status_templates (
  slug text NOT NULL,
  locale text NOT NULL DEFAULT 'tr',
  name text NOT NULL,
  color text NOT NULL,
  lifecycle text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_system_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (locale, slug)
);

CREATE TABLE IF NOT EXISTS public.default_session_status_templates (
  slug text NOT NULL,
  locale text NOT NULL DEFAULT 'tr',
  name text NOT NULL,
  color text NOT NULL,
  lifecycle text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_system_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (locale, slug)
);

CREATE TABLE IF NOT EXISTS public.default_lead_status_templates (
  slug text NOT NULL,
  locale text NOT NULL DEFAULT 'tr',
  name text NOT NULL,
  color text NOT NULL,
  lifecycle text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_system_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (locale, slug)
);

INSERT INTO public.default_project_status_templates
  (locale, slug, name, color, lifecycle, sort_order, is_system_required)
VALUES
  ('en','planned','Planned','#6B7280','active',1,true),
  ('en','proposal','Proposal Sent','#FBBF24','active',2,false),
  ('en','contract','Contract Signed','#22C55E','active',3,false),
  ('en','in_progress','In Progress','#A855F7','active',4,false),
  ('en','completed','Completed','#16A34A','completed',5,false),
  ('en','cancelled','Cancelled','#DC2626','cancelled',6,false),
  ('tr','planned','Planlandı','#4B5563','active',1,true),
  ('tr','proposal','Teklif Gönderildi','#FBBF24','active',2,false),
  ('tr','contract','Sözleşme İmzalandı','#22C55E','active',3,false),
  ('tr','in_progress','Devam Ediyor','#A855F7','active',4,false),
  ('tr','completed','Tamamlandı','#16A34A','completed',5,false),
  ('tr','cancelled','İptal','#DC2626','cancelled',6,false)
ON CONFLICT (locale, slug) DO UPDATE
SET name = EXCLUDED.name,
    color = EXCLUDED.color,
    lifecycle = EXCLUDED.lifecycle,
    sort_order = EXCLUDED.sort_order,
    is_system_required = EXCLUDED.is_system_required;

INSERT INTO public.default_session_status_templates
  (locale, slug, name, color, lifecycle, sort_order, is_system_required)
VALUES
  ('en','planned','Planned','#6B7280','active',1,true),
  ('en','scheduled','Scheduled','#0EA5E9','active',2,false),
  ('en','preparing','Preparing','#FACC15','active',3,false),
  ('en','in_progress','In Progress','#8B5CF6','active',4,false),
  ('en','completed','Completed','#22C55E','completed',5,false),
  ('en','cancelled','Cancelled','#DC2626','cancelled',6,false),
  ('tr','planned','Planlandı','#4B5563','active',1,true),
  ('tr','scheduled','Planlandı','#0EA5E9','active',2,false),
  ('tr','preparing','Hazırlık','#FACC15','active',3,false),
  ('tr','in_progress','Çekim Sürüyor','#8B5CF6','active',4,false),
  ('tr','completed','Tamamlandı','#22C55E','completed',5,false),
  ('tr','cancelled','İptal','#DC2626','cancelled',6,false)
ON CONFLICT (locale, slug) DO UPDATE
SET name = EXCLUDED.name,
    color = EXCLUDED.color,
    lifecycle = EXCLUDED.lifecycle,
    sort_order = EXCLUDED.sort_order,
    is_system_required = EXCLUDED.is_system_required;

INSERT INTO public.default_lead_status_templates
  (locale, slug, name, color, lifecycle, sort_order, is_system_required)
VALUES
  ('en','new','New','#6B7280','active',1,true),
  ('en','qualified','Qualified','#FACC15','active',2,false),
  ('en','proposal','Proposal Sent','#3B82F6','active',3,false),
  ('en','negotiation','Negotiation','#A855F7','active',4,false),
  ('en','won','Won','#22C55E','completed',5,false),
  ('en','lost','Lost','#DC2626','cancelled',6,false),
  ('tr','new','Yeni','#4B5563','active',1,true),
  ('tr','qualified','Nitelikli','#FACC15','active',2,false),
  ('tr','proposal','Teklif Gönderildi','#3B82F6','active',3,false),
  ('tr','negotiation','Görüşme','#A855F7','active',4,false),
  ('tr','won','Kazanıldı','#22C55E','completed',5,false),
  ('tr','lost','Kaybedildi','#DC2626','cancelled',6,false)
ON CONFLICT (locale, slug) DO UPDATE
SET name = EXCLUDED.name,
    color = EXCLUDED.color,
    lifecycle = EXCLUDED.lifecycle,
    sort_order = EXCLUDED.sort_order,
    is_system_required = EXCLUDED.is_system_required;

-- Helper for fallback locale (already defined earlier but ensure idempotency)
CREATE OR REPLACE FUNCTION public.get_org_locale(org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $function$
  SELECT COALESCE(preferred_locale, 'tr')
  FROM public.organization_settings
  WHERE organization_id = org_id
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_default_project_statuses_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  status_count integer;
  final_locale text := COALESCE(get_org_locale(org_id), 'tr');
BEGIN
  SELECT COUNT(*) INTO status_count
  FROM public.project_statuses
  WHERE organization_id = org_id;

  IF status_count > 0 THEN
    RETURN;
  END IF;

  WITH prioritized AS (
    SELECT *, 1 AS priority
    FROM public.default_project_status_templates
    WHERE locale = final_locale
    UNION ALL
    SELECT *, 2
    FROM public.default_project_status_templates
    WHERE locale = 'en'
  ),
  chosen AS (
    SELECT DISTINCT ON (slug) *
    FROM prioritized
    ORDER BY slug, priority
  )
  INSERT INTO public.project_statuses (
    user_id,
    organization_id,
    template_slug,
    name,
    color,
    lifecycle,
    sort_order,
    is_system_required
  )
  SELECT
    user_uuid,
    org_id,
    slug,
    name,
    color,
    lifecycle,
    sort_order,
    is_system_required
  FROM chosen
  ORDER BY sort_order;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_default_session_statuses(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  status_count integer;
  final_locale text := COALESCE(get_org_locale(org_id), 'tr');
BEGIN
  SELECT COUNT(*) INTO status_count
  FROM public.session_statuses
  WHERE organization_id = org_id;

  IF status_count > 0 THEN
    RETURN;
  END IF;

  WITH prioritized AS (
    SELECT *, 1 AS priority
    FROM public.default_session_status_templates
    WHERE locale = final_locale
    UNION ALL
    SELECT *, 2
    FROM public.default_session_status_templates
    WHERE locale = 'en'
  ),
  chosen AS (
    SELECT DISTINCT ON (slug) *
    FROM prioritized
    ORDER BY slug, priority
  )
  INSERT INTO public.session_statuses (
    user_id,
    organization_id,
    template_slug,
    name,
    color,
    lifecycle,
    sort_order,
    is_system_required,
    is_system_initial
  )
  SELECT
    user_uuid,
    org_id,
    slug,
    name,
    color,
    lifecycle,
    sort_order,
    (sort_order = 1),
    (slug = 'planned')
  FROM chosen
  ORDER BY sort_order;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_default_lead_statuses_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  status_count integer;
  final_locale text := COALESCE(get_org_locale(org_id), 'tr');
BEGIN
  SELECT COUNT(*) INTO status_count
  FROM public.lead_statuses
  WHERE organization_id = org_id;

  IF status_count > 0 THEN
    RETURN;
  END IF;

  WITH prioritized AS (
    SELECT *, 1 AS priority
    FROM public.default_lead_status_templates
    WHERE locale = final_locale
    UNION ALL
    SELECT *, 2
    FROM public.default_lead_status_templates
    WHERE locale = 'en'
  ),
  chosen AS (
    SELECT DISTINCT ON (slug) *
    FROM prioritized
    ORDER BY slug, priority
  )
  INSERT INTO public.lead_statuses (
    user_id,
    organization_id,
    template_slug,
    name,
    color,
    lifecycle,
    sort_order,
    is_system_required,
    is_system_final
  )
  SELECT
    user_uuid,
    org_id,
    slug,
    name,
    color,
    lifecycle,
    sort_order,
    is_system_required,
    lifecycle <> 'active'
  FROM chosen
  ORDER BY sort_order;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  org_id uuid;
  pending_membership_exists boolean;
  user_invitation_id text;
BEGIN
  user_invitation_id := NEW.raw_user_meta_data ->> 'invitation_id';

  SELECT public.user_has_pending_membership(NEW.id) INTO pending_membership_exists;

  IF pending_membership_exists OR user_invitation_id IS NOT NULL THEN
    INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
    VALUES 
      (NEW.id, 1, true, '09:00', '17:00'),
      (NEW.id, 2, true, '09:00', '17:00'),
      (NEW.id, 3, true, '09:00', '17:00'),
      (NEW.id, 4, true, '09:00', '17:00'),
      (NEW.id, 5, true, '09:00', '17:00'),
      (NEW.id, 6, false, '09:00', '17:00'),
      (NEW.id, 0, false, '09:00', '17:00');
    RETURN NEW;
  END IF;

  INSERT INTO public.organizations (owner_id, name)
  VALUES (NEW.id, 'My Organization')
  RETURNING id INTO org_id;
  
  INSERT INTO public.organization_members (organization_id, user_id, system_role, role, status)
  VALUES (org_id, NEW.id, 'Owner', 'Owner', 'active');
  
  PERFORM public.ensure_user_settings(NEW.id);
  UPDATE public.user_settings 
  SET active_organization_id = org_id 
  WHERE user_id = NEW.id;
  
  INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
  VALUES 
    (NEW.id, 1, true, '09:00', '17:00'),
    (NEW.id, 2, true, '09:00', '17:00'),
    (NEW.id, 3, true, '09:00', '17:00'),
    (NEW.id, 4, true, '09:00', '17:00'),
    (NEW.id, 5, true, '09:00', '17:00'),
    (NEW.id, 6, false, '09:00', '17:00'),
    (NEW.id, 0, false, '09:00', '17:00');

  PERFORM public.ensure_default_packages_for_org(NEW.id, org_id);
  PERFORM public.ensure_default_project_types_for_org(NEW.id, org_id);
  PERFORM public.ensure_default_lead_statuses_for_org(NEW.id, org_id);
  PERFORM public.ensure_default_project_statuses_for_org(NEW.id, org_id);
  PERFORM public.ensure_default_session_statuses(NEW.id, org_id);
  PERFORM public.ensure_default_lead_field_definitions(org_id, NEW.id);
  PERFORM public.ensure_default_message_templates(NEW.id, org_id);
  PERFORM public.ensure_default_session_reminder_workflows(NEW.id, org_id);

  RETURN NEW;
END;
$function$;
