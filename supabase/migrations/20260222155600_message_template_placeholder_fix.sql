-- Align default message template placeholders with template-builder supported tokens

CREATE TEMP TABLE block_defs_data (
  slug text,
  locale text,
  block_list jsonb,
  placeholder_list text[],
  subject_text text,
  body_text text,
  legacy_subjects text[]
);

INSERT INTO block_defs_data (slug, locale, block_list, placeholder_list, subject_text, body_text, legacy_subjects)
VALUES
  (
    'session_confirmation',
    'en',
    jsonb_build_array(
      jsonb_build_object(
        'id','session_confirmation-text-1',
        'type','text',
        'order',0,
        'visible',true,
        'data',jsonb_build_object(
          'content','Hi {lead_name},',
          'formatting',jsonb_build_object('fontSize','p','alignment','left')
        )
      ),
      jsonb_build_object(
        'id','session_confirmation-text-2',
        'type','text',
        'order',1,
        'visible',true,
        'data',jsonb_build_object(
          'content','We''re excited to meet you on {session_date} at {session_time} ({session_location}).',
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
    ),
    ARRAY['lead_name','session_date','session_time','session_location'],
    'Your session is booked for {session_date|Session Date}',
    'Hi {lead_name}, we''re excited to meet you on {session_date} at {session_time} ({session_location}). Feel free to reply if you need anything before then!',
    ARRAY[
      'Your session is booked for {{session_date}}',
      'Your session is booked for {session_date}'
    ]
  ),
  (
    'session_reminder',
    'en',
    jsonb_build_array(
      jsonb_build_object(
        'id','session_reminder-text-1',
        'type','text',
        'order',0,
        'visible',true,
        'data',jsonb_build_object(
          'content','Hi {lead_name},',
          'formatting',jsonb_build_object('fontSize','p','alignment','left')
        )
      ),
      jsonb_build_object(
        'id','session_reminder-text-2',
        'type','text',
        'order',1,
        'visible',true,
        'data',jsonb_build_object(
          'content','Just a reminder that your session is on {session_date} at {session_time}.',
          'formatting',jsonb_build_object('fontSize','p','alignment','left')
        )
      ),
      jsonb_build_object(
        'id','session_reminder-text-3',
        'type','text',
        'order',2,
        'visible',true,
        'data',jsonb_build_object(
          'content','Let us know if anything changes.',
          'formatting',jsonb_build_object('fontSize','p','alignment','left')
        )
      )
    ),
    ARRAY['lead_name','session_date','session_time'],
    'Reminder: session on {session_date|Session Date}',
    'Hi {lead_name}, just a reminder that your session is on {session_date} at {session_time}. Let us know if anything changes.',
    ARRAY[
      'Reminder: session on {{session_date}}',
      'Reminder: session on {session_date}'
    ]
  ),
  (
    'session_confirmation',
    'tr',
    jsonb_build_array(
      jsonb_build_object(
        'id','session_confirmation-tr-text-1',
        'type','text',
        'order',0,
        'visible',true,
        'data',jsonb_build_object(
          'content','Merhaba {lead_name},',
          'formatting',jsonb_build_object('fontSize','p','alignment','left')
        )
      ),
      jsonb_build_object(
        'id','session_confirmation-tr-text-2',
        'type','text',
        'order',1,
        'visible',true,
        'data',jsonb_build_object(
          'content','{session_date} {session_time} saatinde {session_location} lokasyonunda buluşuyoruz.',
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
    ),
    ARRAY['lead_name','session_date','session_time','session_location'],
    '{session_date|Seans Tarihi} tarihli çekiminiz onaylandı',
    'Merhaba {lead_name}, {session_date} {session_time} saatinde {session_location} lokasyonunda buluşuyoruz. Sorularınız olursa bize yazabilirsiniz!',
    ARRAY[
      '{{session_date}} tarihli çekiminiz onaylandı',
      '{session_date} tarihli çekiminiz onaylandı'
    ]
  ),
  (
    'session_reminder',
    'tr',
    jsonb_build_array(
      jsonb_build_object(
        'id','session_reminder-tr-text-1',
        'type','text',
        'order',0,
        'visible',true,
        'data',jsonb_build_object(
          'content','Merhaba {lead_name},',
          'formatting',jsonb_build_object('fontSize','p','alignment','left')
        )
      ),
      jsonb_build_object(
        'id','session_reminder-tr-text-2',
        'type','text',
        'order',1,
        'visible',true,
        'data',jsonb_build_object(
          'content','Çekiminiz {session_date} {session_time} saatinde gerçekleşecek.',
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
    ),
    ARRAY['lead_name','session_date','session_time'],
    '{session_date|Seans Tarihi} tarihli çekiminiz yaklaşıyor',
    'Merhaba {lead_name}, çekiminiz {session_date} {session_time} saatinde gerçekleşecek. Bir değişiklik olursa bize haber verebilirsiniz.',
    ARRAY[
      '{{session_date}} tarihli çekiminiz yaklaşıyor',
      '{session_date} tarihli çekiminiz yaklaşıyor'
    ]
  );

-- Update default templates with new placeholder + block definitions
UPDATE public.default_message_template_templates AS dst
SET subject = src.subject_text,
    body = src.body_text,
    placeholders = src.placeholder_list,
    blocks = src.block_list
FROM block_defs_data AS src
WHERE dst.slug = src.slug
  AND dst.locale = src.locale;

-- Upgrade existing org templates that still contain legacy double-curly placeholders
UPDATE public.message_templates AS mt
SET master_subject = src.subject_text,
    master_content = src.body_text,
    placeholders = to_jsonb(src.placeholder_list),
    blocks = src.block_list
FROM block_defs_data AS src
WHERE mt.template_slug = src.slug
  AND src.locale = split_part(COALESCE(public.get_org_locale(mt.organization_id), 'tr'), '-', 1)
  AND (
    mt.master_subject = ANY(src.legacy_subjects)
    OR mt.master_subject LIKE '%{{%'
    OR (mt.blocks -> 0 ->> 'type') = 'paragraph'
  );

DROP TABLE IF EXISTS block_defs_data;
