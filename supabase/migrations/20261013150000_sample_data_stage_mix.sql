-- Ensure sample data projects cover proposal stage alongside planned/in-progress.

CREATE OR REPLACE FUNCTION public.seed_sample_data_for_org(
  owner_uuid uuid,
  org_id uuid,
  final_locale text,
  preferred_slugs text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  existing boolean;
  locale_code text := COALESCE(final_locale, 'tr');
  tr_notes_prefix CONSTANT text := '[Örnek] ';
  en_notes_prefix CONSTANT text := '[Sample Data] ';
  notes_prefix text := CASE
    WHEN locale_code LIKE 'tr%' THEN tr_notes_prefix
    ELSE en_notes_prefix
  END;
  start_time timestamptz;
  sanitized_slugs text[] := ARRAY[]::text[];
  project_seed_slugs text[];
  slug_value text;
  canonical_slug text;
  fallback_slugs CONSTANT text[] := ARRAY['wedding','family','commercial','newborn'];
  session_offsets CONSTANT integer[] := ARRAY[1,3,7,14,21,30];
  session_offsets_count integer := array_length(session_offsets, 1);
  location_cycle CONSTANT text[] := ARRAY['Kadıköy Stüdyosu','Moda Sahili','Galata Meydanı','Emirgan Korusu'];
  location_cycle_count integer := array_length(location_cycle, 1);
  project_counter integer := 0;
  proposal_status_applied boolean := false;
  anchor_ts timestamptz;
  base_ts timestamptz;
  base_local timestamp without time zone;
  anchor_local timestamp without time zone;
  org_timezone text;
  project_blueprints CONSTANT jsonb := jsonb_build_array(
    jsonb_build_object(
      'slug','wedding',
      'lead_key','wedding_primary',
      'project_title_tr','Boğaz Düğünü',
      'project_title_en','Bosphorus Wedding',
      'session_label_tr','Düğün Çekimi',
      'session_label_en','Wedding Story',
      'package_slug','wedding_story',
      'project_status_slug','in_progress',
      'session_type_slug','signature_session',
      'session_status','scheduled',
      'session_time','15:00',
      'location','Moda Sahili',
      'session_notes_tr','Shot list Notion''da sabitlendi.',
      'session_notes_en','Shot list pinned inside Notion board.',
      'project_note_tr','Konsept moodboardu onaylandı, satıcılar bilgilendirildi.',
      'project_note_en','Concept mood board approved and vendors informed.',
      'reminder_tr','Kapora makbuzunu paylaş ve prova tarihini teyit et.',
      'reminder_en','Share the deposit receipt and confirm the rehearsal date.',
      'reminder_offset_days',5,
      'reminder_time','10:00'
    ),
    jsonb_build_object(
      'slug','family',
      'lead_key','family_primary',
      'project_title_tr','Aile Lifestyle Çekimi',
      'project_title_en','Lifestyle Family Session',
      'session_label_tr','Aile Lifestyle',
      'session_label_en','Family Lifestyle',
      'package_slug','mini_lifestyle',
      'project_status_slug','in_progress',
      'session_type_slug','signature_session',
      'session_status','scheduled',
      'session_time','11:00',
      'location','Maçka Parkı',
      'session_notes_tr','Galeri paylaşıldı, baskılar hazırlanıyor.',
      'session_notes_en','Gallery delivered, prints queued.',
      'project_note_tr','Aile kıyafet önerileri gönderildi, sahne planı bekleniyor.',
      'project_note_en','Wardrobe suggestions sent to the family; waiting on set approval.',
      'reminder_tr','Aileyle konum teyidi yapıp hava durumunu paylaş.',
      'reminder_en','Confirm the location with the family and send the weather outlook.',
      'reminder_offset_days',3,
      'reminder_time','11:00'
    ),
    jsonb_build_object(
      'slug','commercial',
      'lead_key','event_negotiation',
      'project_title_tr','Marka Lansman Çekimi',
      'project_title_en','Brand Launch Shoot',
      'session_label_tr','Kurumsal Kampanya',
      'session_label_en','Brand Campaign',
      'package_slug','wedding_story',
      'project_status_slug','proposal',
      'session_type_slug','mini_session',
      'session_status','scheduled',
      'session_time','10:00',
      'location','Maslak Ofis Bölgesi',
      'session_notes_tr','Moodboard onaylandı, storyboard bekleniyor.',
      'session_notes_en','Mood board approved, waiting on storyboard.',
      'project_note_tr','Kreatif brifing özetlendi, storyboard hazırlanıyor.',
      'project_note_en','Creative brief captured; storyboard in progress.',
      'reminder_tr','Marka temsilcisinden ürün teslim teyidi al.',
      'reminder_en','Confirm product drop-off with the brand contact.',
      'reminder_offset_days',4,
      'reminder_time','09:30'
    ),
    jsonb_build_object(
      'slug','newborn',
      'lead_key','referral_won',
      'project_title_tr','Yenidoğan Belgeseli',
      'project_title_en','Newborn Documentary',
      'session_label_tr','Yenidoğan Belgeseli',
      'session_label_en','Newborn Documentary',
      'package_slug','mini_lifestyle',
      'project_status_slug','planned',
      'session_type_slug','signature_session',
      'session_status','scheduled',
      'session_time','09:30',
      'location','Kadıköy Stüdyosu',
      'session_notes_tr','Stüdyo ısısı ve aksesuarlar hazırlandı.',
      'session_notes_en','Studio temperature and props prepped.',
      'project_note_tr','Stüdyo aksesuarları sterilize edildi, ev çekimi listesi hazır.',
      'project_note_en','Studio props sterilized and in-home checklist ready.',
      'reminder_tr','Ailenin ev adresi ve park talimatını tekrar iste.',
      'reminder_en','Request parking instructions and the exact home entry plan.',
      'reminder_offset_days',2,
      'reminder_time','12:00'
    ),
    jsonb_build_object(
      'slug','children',
      'lead_key','portrait_qualified',
      'project_title_tr','Çocuk Dönüm Çekimi',
      'project_title_en','Children Milestone Session',
      'session_label_tr','Çocuk Milestone',
      'session_label_en','Children Milestone',
      'package_slug','mini_lifestyle',
      'project_status_slug','planned',
      'session_type_slug','mini_session',
      'session_status','scheduled',
      'session_time','13:30',
      'location','Etiler Stüdyosu',
      'session_notes_tr','Renkli arka plan ve balonlar hazır.',
      'session_notes_en','Color backdrops and balloons staged.',
      'project_note_tr','Balon ve konfeti siparişleri verildi.',
      'project_note_en','Balloon and confetti orders confirmed.',
      'reminder_tr','Çocuk doğum günü zaman akışını aileyle paylaş.',
      'reminder_en','Share the birthday timeline with the family.',
      'reminder_offset_days',6,
      'reminder_time','14:30'
    ),
    jsonb_build_object(
      'slug','maternity',
      'lead_key','family_primary',
      'project_title_tr','Hamilelik Belgeseli',
      'project_title_en','Maternity Documentary',
      'session_label_tr','Hamilelik Çekimi',
      'session_label_en','Maternity Session',
      'package_slug','mini_lifestyle',
      'project_status_slug','in_progress',
      'session_type_slug','signature_session',
      'session_status','scheduled',
      'session_time','16:00',
      'location','Heybeliada Sahili',
      'session_notes_tr','Gün batımı için rota onaylandı.',
      'session_notes_en','Sunset route confirmed.',
      'project_note_tr','Elbise provası için bedenler teyit edildi.',
      'project_note_en','Wardrobe fittings confirmed for the gowns.',
      'reminder_tr','Saç-makyaj ekibiyle saatleri kesinleştir.',
      'reminder_en','Lock hair and makeup call times.',
      'reminder_offset_days',7,
      'reminder_time','09:45'
    ),
    jsonb_build_object(
      'slug','birth',
      'lead_key','referral_won',
      'project_title_tr','Doğum Hikayesi',
      'project_title_en','Birth Story',
      'session_label_tr','Doğum Hikayesi',
      'session_label_en','Birth Story',
      'package_slug','wedding_story',
      'project_status_slug','in_progress',
      'session_type_slug','signature_session',
      'session_status','scheduled',
      'session_time','07:30',
      'location','Şişli Hastane Bölgesi',
      'session_notes_tr','Hastane izinleri teyit edildi.',
      'session_notes_en','Hospital access confirmed.',
      'project_note_tr','Hastane iletişim kişisi teyit edildi.',
      'project_note_en','Hospital contact validated for on-call access.',
      'reminder_tr','Gece çekim çantası hazır mı kontrol et.',
      'reminder_en','Double-check the overnight go-bag.',
      'reminder_offset_days',1,
      'reminder_time','22:00'
    ),
    jsonb_build_object(
      'slug','headshots',
      'lead_key','portrait_qualified',
      'project_title_tr','Kurumsal Portre Günü',
      'project_title_en','Corporate Portrait Day',
      'session_label_tr','Kurumsal Portre',
      'session_label_en','Corporate Portrait',
      'package_slug','mini_lifestyle',
      'project_status_slug','proposal',
      'session_type_slug','mini_session',
      'session_status','scheduled',
      'session_time','14:00',
      'location','Levent Stüdyosu',
      'session_notes_tr','Arka plan gri kurulumu tamam.',
      'session_notes_en','Gray seamless set and lighting ready.',
      'project_note_tr','Kurumsal arka plan kuruldu, ışık planı finalize edildi.',
      'project_note_en','Corporate backdrop set and lighting diagram finalized.',
      'reminder_tr','Çekim günü giriş listesi ve güvenlik kartlarını gönder.',
      'reminder_en','Send entry list and security badges.',
      'reminder_offset_days',5,
      'reminder_time','08:30'
    ),
    jsonb_build_object(
      'slug','senior',
      'lead_key','portrait_qualified',
      'project_title_tr','Mezuniyet Hikayesi',
      'project_title_en','Senior Story',
      'session_label_tr','Mezuniyet Çekimi',
      'session_label_en','Senior Session',
      'package_slug','mini_lifestyle',
      'project_status_slug','planned',
      'session_type_slug','mini_session',
      'session_status','scheduled',
      'session_time','17:00',
      'location','Galata Meydanı',
      'session_notes_tr','Kıyafet listesi Google Drive''da onaylandı.',
      'session_notes_en','Wardrobe list approved via shared folder.',
      'project_note_tr','Lokasyon rotası paylaşıldı, aksesuar listesi hazırlandı.',
      'project_note_en','Shared the walking route and accessory list.',
      'reminder_tr','Kostüm seçeneklerini tekrar iste.',
      'reminder_en','Request final costume confirmations.',
      'reminder_offset_days',4,
      'reminder_time','09:15'
    ),
    jsonb_build_object(
      'slug','event',
      'lead_key','event_negotiation',
      'project_title_tr','Etkinlik Belgeleme',
      'project_title_en','Event Coverage',
      'session_label_tr','Etkinlik Çekimi',
      'session_label_en','Event Coverage',
      'package_slug','wedding_story',
      'project_status_slug','in_progress',
      'session_type_slug','signature_session',
      'session_status','scheduled',
      'session_time','12:30',
      'location','Haliç Kongre Bölgesi',
      'session_notes_tr','Program akışı paylaşıldı.',
      'session_notes_en','Run of show shared.',
      'project_note_tr','Program akışı asistanla paylaşıldı.',
      'project_note_en','Agenda shared with the assistant.',
      'reminder_tr','Ajandayla konuşarak konuşmacı saatlerini kesinleştir.',
      'reminder_en','Sync with the MC to finalize speaker slots.',
      'reminder_offset_days',8,
      'reminder_time','13:00'
    ),
    jsonb_build_object(
      'slug','pet',
      'lead_key','mini_lost',
      'project_title_tr','Evcil Dost Çekimi',
      'project_title_en','Pet Session',
      'session_label_tr','Evcil Dost',
      'session_label_en','Pet Session',
      'package_slug','mini_lifestyle',
      'project_status_slug','planned',
      'session_type_slug','mini_session',
      'session_status','scheduled',
      'session_time','09:00',
      'location','Caddebostan Sahili',
      'session_notes_tr','Oyun alanı ve ödüller hazır.',
      'session_notes_en','Play zone and treats are stocked.',
      'project_note_tr','Ödül mamaları ve oyuncaklar paketlendi.',
      'project_note_en','Treats and toys packed for the shoot.',
      'reminder_tr','Sahiplerinden davranış notlarını iste.',
      'reminder_en','Request behavior notes from the owners.',
      'reminder_offset_days',2,
      'reminder_time','15:00'
    ),
    jsonb_build_object(
      'slug','real_estate',
      'lead_key','event_negotiation',
      'project_title_tr','Gayrimenkul Çekimi',
      'project_title_en','Real Estate Shoot',
      'session_label_tr','Gayrimenkul Çekimi',
      'session_label_en','Real Estate Shoot',
      'package_slug','mini_lifestyle',
      'project_status_slug','proposal',
      'session_type_slug','mini_session',
      'session_status','scheduled',
      'session_time','10:30',
      'location','Çengelköy Tepesi',
      'session_notes_tr','Plan ve kat çizimleri paylaşıldı.',
      'session_notes_en','Shared the floor plans and shot list.',
      'project_note_tr','Çekim listesi kat planına işlendi.',
      'project_note_en','Shot list mapped to the floor plan.',
      'reminder_tr','Temizlik firmasından hazır teyidi al.',
      'reminder_en','Confirm prep completion with the cleaning team.',
      'reminder_offset_days',3,
      'reminder_time','09:00'
    )
  );
  lead_payloads CONSTANT jsonb := jsonb_build_array(
    jsonb_build_object(
      'key','wedding_primary',
      'name_tr','Ayşe & Mehmet',
      'name_en','Sarah & Daniel',
      'status_slug','new',
      'email','sample+wedding.tr@lumiso.app',
      'phone','+90 532 000 0010',
      'notes_tr','Fuar standında tanışıldı, hızlı teklif istedi.',
      'notes_en','Met at the expo, expecting a fast quote.'
    ),
    jsonb_build_object(
      'key','family_primary',
      'name_tr','Zeynep Kılıç',
      'name_en','Olivia Carter',
      'status_slug','proposal',
      'email','sample+family.tr@lumiso.app',
      'phone','+90 532 000 0011',
      'notes_tr','Sözleşme taslağı gönderildi, onay bekliyor.',
      'notes_en','Draft contract sent, awaiting approval.'
    ),
    jsonb_build_object(
      'key','referral_won',
      'name_tr','Ece & Bora',
      'name_en','Noah & Emma',
      'status_slug','won',
      'email','sample+referral.tr@lumiso.app',
      'phone','+90 532 000 0012',
      'notes_tr','Referans müşteri, albüm yükseltmesi istedi.',
      'notes_en','Referral client requesting album upgrade.'
    ),
    jsonb_build_object(
      'key','event_negotiation',
      'name_tr','Deniz & Kerem',
      'name_en','Lucas & Mia',
      'status_slug','negotiation',
      'email','sample+event.tr@lumiso.app',
      'phone','+90 532 000 0013',
      'notes_tr','Çift bütçe güncellemesi istedi, yeni teklif hazırlandı.',
      'notes_en','Couple asked for budget revision; new quote drafted.'
    ),
    jsonb_build_object(
      'key','portrait_qualified',
      'name_tr','Selin Aksoy',
      'name_en','Emily Parker',
      'status_slug','qualified',
      'email','sample+portrait.tr@lumiso.app',
      'phone','+90 532 000 0014',
      'notes_tr','Portre konsepti netleşti, çekim tarihi bekleniyor.',
      'notes_en','Portrait concept approved, waiting for shoot date.'
    ),
    jsonb_build_object(
      'key','mini_lost',
      'name_tr','Burcu & Tolga',
      'name_en','Grace & Ethan',
      'status_slug','lost',
      'email','sample+mini.tr@lumiso.app',
      'phone','+90 532 000 0015',
      'notes_tr','Rakip çekim paketini seçti, değerlendirme notu bırakıldı.',
      'notes_en','Chose a competitor package; captured follow-up note.'
    )
  );
  lead_elem RECORD;
  lead_obj jsonb;
  lead_id uuid;
  lead_key text;
  lead_name text;
  lead_email text;
  lead_phone text;
  notes_tr text;
  notes_en text;
  lead_note text;
  lead_status_slug text;
  lead_status_record RECORD;
  lead_map jsonb := '{}'::jsonb;
  project_blueprint jsonb;
  blueprint_default jsonb;
  project_title text;
  session_label text;
  package_slug text;
  project_status_slug text;
  session_type_slug text;
  session_status text;
  session_time_text text;
  session_time_value time without time zone;
  session_location text;
  session_notes text;
  session_notes_tr text;
  session_notes_en text;
  selected_package RECORD;
  project_status_record RECORD;
  session_type_primary RECORD;
  session_type_mini RECORD;
  session_type_record RECORD;
  package_primary RECORD;
  package_mini RECORD;
  project_type_id uuid;
  lead_for_project uuid;
  project_id uuid;
  session_id uuid;
  offset_index integer;
  offset_days integer;
  project_status_planned RECORD;
  project_status_in_progress RECORD;
  project_status_completed RECORD;
  project_status_proposal RECORD;
  project_description text;
  project_note_tr text;
  project_note_en text;
  reminder_tr text;
  reminder_en text;
  reminder_offset integer;
  reminder_time_text text;
  reminder_due_ts timestamptz;
  reminder_time_value time without time zone;
  activity_note_id uuid;
  activity_reminder_id uuid;
  deposit_percent numeric;
  deposit_snapshot_amount numeric;
  deposit_config jsonb;
  reminder_content text;
  note_content text;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM public.leads
    WHERE organization_id = org_id
      AND (
        notes ILIKE '%' || en_notes_prefix || '%'
        OR notes ILIKE '%' || tr_notes_prefix || '%'
      )
  ) INTO existing;

  IF existing THEN
    PERFORM public.log_intake_seeding_event(
      org_id,
      owner_uuid,
      'seed_sample_data_for_org',
      'skipped',
      'Sample data already exists for org.',
      jsonb_build_object('reason', 'existing_sample_data')
    );
    RETURN;
  END IF;

  SELECT COALESCE(os.profile_intake_completed_at, o.created_at, timezone('UTC', now()))
       , COALESCE(os.timezone, 'UTC')
  INTO anchor_ts, org_timezone
  FROM public.organizations AS o
  LEFT JOIN public.organization_settings AS os ON os.organization_id = o.id
  WHERE o.id = org_id;

  IF anchor_ts IS NULL THEN
    anchor_ts := timezone('UTC', now());
  END IF;

  IF org_timezone IS NULL OR NULLIF(trim(org_timezone), '') IS NULL THEN
    org_timezone := 'UTC';
  END IF;

  anchor_local := anchor_ts AT TIME ZONE org_timezone;
  base_local := GREATEST(anchor_local, now() AT TIME ZONE org_timezone);
  base_ts := base_local AT TIME ZONE org_timezone;

  blueprint_default := (
    SELECT value
    FROM jsonb_array_elements(project_blueprints) AS bp(value)
    WHERE value->>'slug' = 'wedding'
    LIMIT 1
  );

  IF preferred_slugs IS NOT NULL THEN
    FOREACH slug_value IN ARRAY preferred_slugs LOOP
      IF slug_value IS NULL THEN
        CONTINUE;
      END IF;

      slug_value := lower(slug_value);

      SELECT tpl.slug
      INTO canonical_slug
      FROM public.default_project_type_templates AS tpl
      WHERE tpl.slug = slug_value
      LIMIT 1;

      IF canonical_slug IS NOT NULL AND NOT (canonical_slug = ANY(sanitized_slugs)) THEN
        sanitized_slugs := sanitized_slugs || canonical_slug;
      END IF;
    END LOOP;
  END IF;

  IF array_length(sanitized_slugs, 1) IS NULL THEN
    sanitized_slugs := fallback_slugs;
  END IF;

  project_seed_slugs := sanitized_slugs;

  SELECT EXISTS (
    SELECT 1
    FROM unnest(project_seed_slugs) AS s(slug)
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        (SELECT value
         FROM jsonb_array_elements(project_blueprints) AS bp(value)
         WHERE value->>'slug' = s.slug
         LIMIT 1),
        blueprint_default
      ) AS blueprint
    ) AS picked
    WHERE COALESCE(picked.blueprint->>'project_status_slug', 'in_progress') = 'proposal'
  ) INTO proposal_status_applied;

  start_time := clock_timestamp();

  PERFORM public.log_intake_seeding_event(
    org_id,
    owner_uuid,
    'seed_sample_data_for_org',
    'started',
    'Creating localized sample data set.',
    jsonb_build_object(
      'resolved_locale',
      locale_code,
      'preferred_project_type_slugs',
      preferred_slugs,
      'sanitized_project_type_slugs',
      to_jsonb(project_seed_slugs)
    )
  );

  SELECT id, name
  INTO session_type_primary
  FROM public.session_types
  WHERE organization_id = org_id AND template_slug = 'signature_session'
  LIMIT 1;

  SELECT id, name
  INTO session_type_mini
  FROM public.session_types
  WHERE organization_id = org_id AND template_slug = 'mini_session'
  LIMIT 1;

  SELECT id, price, template_slug
  INTO package_primary
  FROM public.packages
  WHERE organization_id = org_id AND template_slug = 'wedding_story'
  LIMIT 1;

  SELECT id, price, template_slug
  INTO package_mini
  FROM public.packages
  WHERE organization_id = org_id AND template_slug = 'mini_lifestyle'
  LIMIT 1;

  SELECT id, name
  INTO project_status_in_progress
  FROM public.project_statuses
  WHERE organization_id = org_id AND template_slug = 'in_progress'
  ORDER BY sort_order
  LIMIT 1;

  SELECT id, name
  INTO project_status_completed
  FROM public.project_statuses
  WHERE organization_id = org_id AND template_slug = 'completed'
  ORDER BY sort_order
  LIMIT 1;

  SELECT id, name
  INTO project_status_planned
  FROM public.project_statuses
  WHERE organization_id = org_id AND template_slug = 'planned'
  ORDER BY sort_order
  LIMIT 1;

  SELECT id, name
  INTO project_status_proposal
  FROM public.project_statuses
  WHERE organization_id = org_id AND template_slug = 'proposal'
  ORDER BY sort_order
  LIMIT 1;

  FOR lead_elem IN
    SELECT value
    FROM jsonb_array_elements(lead_payloads) AS payload(value)
  LOOP
    lead_obj := lead_elem.value;
    lead_id := gen_random_uuid();
    lead_key := lead_obj->>'key';
    lead_name := CASE
      WHEN locale_code LIKE 'tr%' THEN lead_obj->>'name_tr'
      ELSE COALESCE(lead_obj->>'name_en', lead_obj->>'name_tr')
    END;
    lead_email := lead_obj->>'email';
    lead_phone := lead_obj->>'phone';
    lead_status_slug := COALESCE(lead_obj->>'status_slug', 'new');

    SELECT id, name
    INTO lead_status_record
    FROM public.lead_statuses
    WHERE organization_id = org_id
      AND template_slug = lead_status_slug
    ORDER BY sort_order
    LIMIT 1;

    notes_tr := lead_obj->>'notes_tr';
    notes_en := lead_obj->>'notes_en';
    lead_note := notes_prefix || COALESCE(notes_tr, 'Örnek veri');

    IF notes_en IS NOT NULL THEN
      lead_note := lead_note || ' / EN: ' || notes_en;
    END IF;

    INSERT INTO public.leads (
      id,
      organization_id,
      user_id,
      name,
      email,
      phone,
      status,
      status_id,
      notes,
      created_at,
      updated_at
    ) VALUES (
      lead_id,
      org_id,
      owner_uuid,
      lead_name,
      lead_email,
      lead_phone,
      COALESCE(lead_status_record.name, initcap(lead_status_slug)),
      lead_status_record.id,
      lead_note,
      now(),
      now()
    );

    lead_map := lead_map || jsonb_build_object(lead_key, lead_id::text);
  END LOOP;

  FOR slug_value IN SELECT unnest(project_seed_slugs)
  LOOP
    IF slug_value IS NULL THEN
      CONTINUE;
    END IF;

    SELECT value
    INTO project_blueprint
    FROM jsonb_array_elements(project_blueprints) AS bp(value)
    WHERE value->>'slug' = slug_value
    LIMIT 1;

    IF project_blueprint IS NULL THEN
      project_blueprint := blueprint_default;
    END IF;

    package_slug := COALESCE(project_blueprint->>'package_slug', 'wedding_story');
    project_status_slug := COALESCE(project_blueprint->>'project_status_slug', 'in_progress');

    -- Ensure at least one demo project exercises the proposal stage.
    IF project_status_slug = 'proposal' THEN
      proposal_status_applied := true;
    ELSIF NOT proposal_status_applied AND project_status_slug = 'in_progress' THEN
      project_status_slug := 'proposal';
      proposal_status_applied := true;
    END IF;

    session_type_slug := COALESCE(project_blueprint->>'session_type_slug', 'signature_session');
    session_status := COALESCE(project_blueprint->>'session_status', 'scheduled');
    session_time_text := COALESCE(project_blueprint->>'session_time', '14:00');
    session_time_value := session_time_text::time;
    session_notes_tr := project_blueprint->>'session_notes_tr';
    session_notes_en := project_blueprint->>'session_notes_en';
    session_notes := notes_prefix || COALESCE(session_notes_tr, 'Demo oturumu planlandı.');

    IF session_notes_en IS NOT NULL THEN
      session_notes := session_notes || ' / EN: ' || session_notes_en;
    END IF;

    lead_key := COALESCE(project_blueprint->>'lead_key', 'wedding_primary');
    lead_for_project := NULL;

    IF lead_map ? lead_key THEN
      lead_for_project := (lead_map->>lead_key)::uuid;
    END IF;

    IF lead_for_project IS NULL AND lead_map ? 'wedding_primary' THEN
      lead_for_project := (lead_map->>'wedding_primary')::uuid;
    END IF;

    IF lead_for_project IS NULL THEN
      CONTINUE;
    END IF;

    SELECT id
    INTO project_type_id
    FROM public.project_types
    WHERE organization_id = org_id
      AND template_slug = slug_value
    ORDER BY sort_order
    LIMIT 1;

    IF project_type_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT id, price, template_slug
    INTO selected_package
    FROM public.packages
    WHERE organization_id = org_id
      AND template_slug = package_slug
    LIMIT 1;

    IF selected_package.id IS NULL THEN
      IF package_slug = 'mini_lifestyle' THEN
        selected_package := package_mini;
      ELSE
        selected_package := package_primary;
      END IF;
    END IF;

    IF selected_package.id IS NULL THEN
      CONTINUE;
    END IF;

    IF session_type_slug = 'mini_session' THEN
      session_type_record := session_type_mini;
    ELSE
      session_type_record := session_type_primary;
    END IF;

    IF session_type_record.id IS NULL THEN
      session_type_record := session_type_primary;
    END IF;

    IF session_type_record.id IS NULL THEN
      CONTINUE;
    END IF;

    CASE project_status_slug
      WHEN 'completed' THEN project_status_record := project_status_completed;
      WHEN 'proposal' THEN project_status_record := project_status_proposal;
      WHEN 'planned' THEN project_status_record := project_status_planned;
      ELSE project_status_record := project_status_in_progress;
    END CASE;

    IF project_status_record.id IS NULL THEN
      project_status_record := project_status_in_progress;
    END IF;

    IF project_status_record.id IS NULL THEN
      CONTINUE;
    END IF;

    deposit_percent := CASE package_slug
      WHEN 'mini_lifestyle' THEN 30
      WHEN 'wedding_story' THEN 40
      ELSE 25
    END;

    deposit_snapshot_amount := round(COALESCE(selected_package.price, 0) * deposit_percent / 100.0, 2);
    deposit_config := jsonb_build_object(
      'mode', 'percent_base',
      'value', deposit_percent,
      'description', 'Kapora (%' || deposit_percent || ')',
      'snapshot_amount', deposit_snapshot_amount,
      'snapshot_total', selected_package.price,
      'snapshot_locked_at', to_char(base_ts, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'snapshot_note', 'Sample data kapora planı'
    );

    note_content := CASE
      WHEN locale_code LIKE 'tr%' THEN COALESCE(project_blueprint->>'project_note_tr', 'Plan güncellendi.')
      ELSE COALESCE(project_blueprint->>'project_note_en', project_blueprint->>'project_note_tr', 'Plan updated.')
    END;
    project_description := notes_prefix || note_content;

    reminder_content := CASE
      WHEN locale_code LIKE 'tr%' THEN COALESCE(project_blueprint->>'reminder_tr', 'Kapora teyidi yap.')
      ELSE COALESCE(project_blueprint->>'reminder_en', project_blueprint->>'reminder_tr', 'Confirm deposit.')
    END;

    reminder_offset := COALESCE((project_blueprint->>'reminder_offset_days')::int, 7);
    reminder_time_text := COALESCE(project_blueprint->>'reminder_time', '10:00');
    reminder_due_ts := base_ts + (reminder_offset || ' days')::interval;

    project_title := CASE
      WHEN locale_code LIKE 'tr%' THEN COALESCE(project_blueprint->>'project_title_tr', initcap(slug_value))
      ELSE COALESCE(project_blueprint->>'project_title_en', project_blueprint->>'project_title_tr', initcap(slug_value))
    END;
    project_title := notes_prefix || project_title;

    session_label := CASE
      WHEN locale_code LIKE 'tr%' THEN COALESCE(project_blueprint->>'session_label_tr', project_title)
      ELSE COALESCE(project_blueprint->>'session_label_en', project_blueprint->>'session_label_tr', project_title)
    END;
    session_label := notes_prefix || session_label;

    project_counter := project_counter + 1;

    session_location := COALESCE(
      project_blueprint->>'location',
      location_cycle[MOD(project_counter - 1, COALESCE(location_cycle_count, 1)) + 1]
    );

    offset_index := MOD(project_counter - 1, COALESCE(session_offsets_count, 1)) + 1;
    offset_days := session_offsets[offset_index];

    project_id := gen_random_uuid();
    session_id := gen_random_uuid();
    activity_note_id := gen_random_uuid();
    activity_reminder_id := gen_random_uuid();

    INSERT INTO public.projects (
      id,
      organization_id,
      user_id,
      lead_id,
      name,
      description,
      status_id,
      project_type_id,
      package_id,
      base_price,
      deposit_config,
      created_at,
      updated_at
    ) VALUES (
      project_id,
      org_id,
      owner_uuid,
      lead_for_project,
      project_title,
      project_description,
      project_status_record.id,
      project_type_id,
      selected_package.id,
      selected_package.price,
      deposit_config,
      now(),
      now()
    );

    INSERT INTO public.sessions (
      id,
      organization_id,
      user_id,
      lead_id,
      project_id,
      session_type_id,
      session_name,
      session_date,
      session_time,
      status,
      location,
      notes,
      created_at,
      updated_at
    ) VALUES (
      session_id,
      org_id,
      owner_uuid,
      lead_for_project,
      project_id,
      session_type_record.id,
      session_label,
      (base_local + (offset_days || ' days')::interval)::date,
      session_time_value,
      session_status,
      session_location,
      session_notes,
      now(),
      now()
    );

    INSERT INTO public.activities (
      id,
      organization_id,
      user_id,
      lead_id,
      project_id,
      type,
      content,
      reminder_date,
      reminder_time,
      completed,
      template_slug,
      created_at,
      updated_at
    ) VALUES (
      activity_note_id,
      org_id,
      owner_uuid,
      lead_for_project,
      project_id,
      'note',
      project_description,
      NULL,
      NULL,
      NULL,
      'sample_data',
      now(),
      now()
    );

    reminder_time_value := COALESCE(reminder_time_text, '10:00')::time;

    INSERT INTO public.activities (
      id,
      organization_id,
      user_id,
      lead_id,
      project_id,
      type,
      content,
      reminder_date,
      reminder_time,
      completed,
      template_slug,
      created_at,
      updated_at
    ) VALUES (
      activity_reminder_id,
      org_id,
      owner_uuid,
      lead_for_project,
      project_id,
      'reminder',
      notes_prefix || reminder_content,
      reminder_due_ts,
      reminder_time_value,
      false,
      'sample_data',
      now(),
      now()
    );
  END LOOP;

  PERFORM public.log_intake_seeding_event(
    org_id,
    owner_uuid,
    'seed_sample_data_for_org',
    'succeeded',
    'Sample data created.',
    jsonb_build_object(
      'resolved_locale',
      locale_code,
      'preferred_project_type_slugs',
      preferred_slugs,
      'sanitized_project_type_slugs',
      to_jsonb(project_seed_slugs),
      'duration_ms',
      FLOOR(EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000)
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    PERFORM public.log_intake_seeding_event(
      org_id,
      owner_uuid,
      'seed_sample_data_for_org',
      'failed',
      'Sample data seeding failed.',
      jsonb_build_object(
        'resolved_locale',
        locale_code,
        'preferred_project_type_slugs',
        preferred_slugs,
        'sanitized_project_type_slugs',
        to_jsonb(project_seed_slugs)
      ),
      SQLERRM
    );
    RAISE;
END;
$function$;
