-- Localized templates for message content (session confirmation / reminder)

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS template_slug text;

CREATE TABLE IF NOT EXISTS public.default_message_template_templates (
  slug text NOT NULL,
  locale text NOT NULL DEFAULT 'tr',
  name text NOT NULL,
  category text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  placeholders text[] NOT NULL DEFAULT '{}',
  blocks jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (locale, slug)
);

INSERT INTO public.default_message_template_templates
  (locale, slug, name, category, subject, body, placeholders, blocks, sort_order)
VALUES
  (
    'en',
    'session_confirmation',
    'Session Confirmation',
    'session_confirmation',
    'Your session is booked for {{session_date}}',
    'Hi {{client_first_name}}, we''re excited to meet you on {{session_date}} at {{session_time}} ({{location}}). Reply if you need anything before then!',
    ARRAY['client_first_name','session_date','session_time','location'],
    jsonb_build_array(
      jsonb_build_object('type','paragraph','content','Hi {{client_first_name}},'),
      jsonb_build_object('type','paragraph','content','We''re excited to meet you on {{session_date}} at {{session_time}} ({{location}}).'),
      jsonb_build_object('type','paragraph','content','Feel free to reply if you need anything before then!')
    ),
    1
  ),
  (
    'en',
    'session_reminder',
    'Session Reminder (3 days)',
    'session_reminder',
    'Reminder: session on {{session_date}}',
    'Just a friendly reminder that your session is coming up on {{session_date}} at {{session_time}}. Let us know if plans change!',
    ARRAY['session_date','session_time'],
    jsonb_build_array(
      jsonb_build_object('type','paragraph','content','Hi there,'),
      jsonb_build_object('type','paragraph','content','Just a friendly reminder that your session is coming up on {{session_date}} at {{session_time}}.'),
      jsonb_build_object('type','paragraph','content','Let us know if you need anything!')
    ),
    2
  ),
  (
    'tr',
    'session_confirmation',
    'Çekim Onayı',
    'session_confirmation',
    '{{session_date}} tarihli çekiminiz onaylandı',
    'Merhaba {{client_first_name}}, {{session_date}} {{session_time}} saatinde {{location}} lokasyonunda buluşuyoruz. Herhangi bir sorunuz olursa bize yazabilirsiniz!',
    ARRAY['client_first_name','session_date','session_time','location'],
    jsonb_build_array(
      jsonb_build_object('type','paragraph','content','Merhaba {{client_first_name}},'),
      jsonb_build_object('type','paragraph','content','{{session_date}} {{session_time}} saatinde {{location}} lokasyonunda buluşuyoruz.'),
      jsonb_build_object('type','paragraph','content','Sorularınız olursa bize yazabilirsiniz!')
    ),
    1
  ),
  (
    'tr',
    'session_reminder',
    'Çekim Hatırlatıcısı (3 gün)',
    'session_reminder',
    '{{session_date}} tarihli çekiminiz yaklaşıyor',
    'Kısa bir hatırlatma: Çekiminiz {{session_date}} {{session_time}} saatinde gerçekleşecek. Bir değişiklik olursa bize haber verebilirsiniz.',
    ARRAY['session_date','session_time'],
    jsonb_build_array(
      jsonb_build_object('type','paragraph','content','Merhaba,'),
      jsonb_build_object('type','paragraph','content','Kısa bir hatırlatma: Çekiminiz {{session_date}} {{session_time}} saatinde gerçekleşecek.'),
      jsonb_build_object('type','paragraph','content','Bir değişiklik olursa bize haber verebilirsiniz.')
    ),
    2
  )
ON CONFLICT (locale, slug) DO UPDATE
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    placeholders = EXCLUDED.placeholders,
    blocks = EXCLUDED.blocks,
    sort_order = EXCLUDED.sort_order;

CREATE OR REPLACE FUNCTION public.ensure_default_message_templates(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  final_locale text := COALESCE(get_org_locale(org_id), 'tr');
  template_row RECORD;
  template_exists boolean;
  blocks_payload jsonb;
BEGIN
  FOR template_row IN
    WITH prioritized AS (
      SELECT *, 1 AS priority
      FROM public.default_message_template_templates
      WHERE locale = final_locale
      UNION ALL
      SELECT *, 2
      FROM public.default_message_template_templates
      WHERE locale = 'en'
    ),
    chosen AS (
      SELECT DISTINCT ON (slug) *
      FROM prioritized
      ORDER BY slug, priority
    )
    SELECT *
    FROM chosen
    ORDER BY sort_order
  LOOP
    SELECT EXISTS(
      SELECT 1
      FROM public.message_templates
      WHERE organization_id = org_id
        AND template_slug = template_row.slug
    )
    INTO template_exists;

    IF template_exists THEN
      CONTINUE;
    END IF;

    blocks_payload := COALESCE(
      template_row.blocks,
      jsonb_build_array(
        jsonb_build_object('type','paragraph','content', template_row.body)
      )
    );

    INSERT INTO public.message_templates (
      id,
      organization_id,
      user_id,
      template_slug,
      name,
      category,
      master_subject,
      master_content,
      blocks,
      placeholders,
      is_active
    )
    VALUES (
      gen_random_uuid(),
      org_id,
      user_uuid,
      template_row.slug,
      template_row.name,
      template_row.category,
      template_row.subject,
      template_row.body,
      blocks_payload,
      to_jsonb(template_row.placeholders),
      true
    );
  END LOOP;
END;
$function$;
