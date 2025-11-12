-- Align default message template blocks with template-builder schema and upgrade existing rows.

-- 1. Update default template catalog entries with proper block definitions
UPDATE public.default_message_template_templates
SET blocks = jsonb_build_array(
  jsonb_build_object(
    'id','session_confirmation-text-1',
    'type','text',
    'order',0,
    'visible',true,
    'data',jsonb_build_object(
      'content','Hi {{client_first_name}},',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  ),
  jsonb_build_object(
    'id','session_confirmation-text-2',
    'type','text',
    'order',1,
    'visible',true,
    'data',jsonb_build_object(
      'content','We''re excited to meet you on {{session_date}} at {{session_time}} ({{location}}).',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  ),
  jsonb_build_object(
    'id','session_confirmation-text-3',
    'type','text',
    'order',2,
    'visible',true,
    'data',jsonb_build_object(
      'content','Feel free to reply if you need anything before then!',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  )
)
WHERE locale = 'en' AND slug = 'session_confirmation';

UPDATE public.default_message_template_templates
SET blocks = jsonb_build_array(
  jsonb_build_object(
    'id','session_reminder-text-1',
    'type','text',
    'order',0,
    'visible',true,
    'data',jsonb_build_object(
      'content','Hi there,',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  ),
  jsonb_build_object(
    'id','session_reminder-text-2',
    'type','text',
    'order',1,
    'visible',true,
    'data',jsonb_build_object(
      'content','Just a friendly reminder that your session is coming up on {{session_date}} at {{session_time}}.',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  ),
  jsonb_build_object(
    'id','session_reminder-text-3',
    'type','text',
    'order',2,
    'visible',true,
    'data',jsonb_build_object(
      'content','Let us know if you need anything!',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  )
)
WHERE locale = 'en' AND slug = 'session_reminder';

UPDATE public.default_message_template_templates
SET blocks = jsonb_build_array(
  jsonb_build_object(
    'id','session_confirmation-tr-text-1',
    'type','text',
    'order',0,
    'visible',true,
    'data',jsonb_build_object(
      'content','Merhaba {{client_first_name}},',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  ),
  jsonb_build_object(
    'id','session_confirmation-tr-text-2',
    'type','text',
    'order',1,
    'visible',true,
    'data',jsonb_build_object(
      'content','{{session_date}} {{session_time}} saatinde {{location}} lokasyonunda buluşuyoruz.',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  ),
  jsonb_build_object(
    'id','session_confirmation-tr-text-3',
    'type','text',
    'order',2,
    'visible',true,
    'data',jsonb_build_object(
      'content','Sorularınız olursa bize yazabilirsiniz!',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  )
)
WHERE locale = 'tr' AND slug = 'session_confirmation';

UPDATE public.default_message_template_templates
SET blocks = jsonb_build_array(
  jsonb_build_object(
    'id','session_reminder-tr-text-1',
    'type','text',
    'order',0,
    'visible',true,
    'data',jsonb_build_object(
      'content','Merhaba,',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  ),
  jsonb_build_object(
    'id','session_reminder-tr-text-2',
    'type','text',
    'order',1,
    'visible',true,
    'data',jsonb_build_object(
      'content','Kısa bir hatırlatma: Çekiminiz {{session_date}} {{session_time}} saatinde gerçekleşecek.',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  ),
  jsonb_build_object(
    'id','session_reminder-tr-text-3',
    'type','text',
    'order',2,
    'visible',true,
    'data',jsonb_build_object(
      'content','Bir değişiklik olursa bize haber verebilirsiniz.',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  )
)
WHERE locale = 'tr' AND slug = 'session_reminder';

-- 2. Migrate existing message_templates rows from legacy paragraph arrays to block objects
WITH legacy_blocks AS (
  SELECT
    mt.id,
    mt.template_slug,
    jsonb_agg(
      jsonb_build_object(
        'id', concat_ws('-', COALESCE(mt.template_slug, 'template'), 'text', (elem.ordinality - 1)),
        'type','text',
        'order', elem.ordinality - 1,
        'visible', true,
        'data', jsonb_build_object(
          'content', elem.value->>'content',
          'formatting', jsonb_build_object('fontSize','p','alignment','left')
        )
      )
      ORDER BY elem.ordinality
    ) AS converted
  FROM public.message_templates AS mt
  CROSS JOIN LATERAL jsonb_array_elements(mt.blocks) WITH ORDINALITY AS elem(value, ordinality)
  WHERE mt.blocks IS NOT NULL
    AND jsonb_typeof(mt.blocks) = 'array'
    AND (mt.blocks->0->>'type') = 'paragraph'
  GROUP BY mt.id, mt.template_slug
)
UPDATE public.message_templates AS mt
SET blocks = lb.converted
FROM legacy_blocks AS lb
WHERE mt.id = lb.id;
