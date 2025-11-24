-- One-off demo account and localized dataset for Lumiso Demo / Sweet Dreams Photography.
-- Creates the auth user (email confirmed), ensures org/settings are ready,
-- and seeds a realistic mix of leads, projects, sessions, activities, and payments.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  target_email CONSTANT text := 'support@lumiso.app';
  target_password CONSTANT text := 'support@lumiso.app';
  target_full_name CONSTANT text := 'Lumiso Demo';
  target_org_name CONSTANT text := 'Sweet Dreams Photography';
  tz CONSTANT text := 'Europe/Istanbul';
  locale CONSTANT text := 'tr';
  owner_uuid uuid;
  org_id uuid;
  now_utc timestamptz := timezone('UTC', now());
  base_local timestamp := (now() AT TIME ZONE tz);
  lead_payloads jsonb;
  lead_row jsonb;
  lead_id uuid;
  lead_map jsonb := '{}'::jsonb;
  lead_status_rec RECORD;
  lead_status_slug text;
  mapped_lead_status_slug text;
  project_payloads jsonb;
  project_row jsonb;
  project_id uuid;
  session_id uuid;
  activity_note_id uuid;
  activity_reminder_id uuid;
  project_status_rec RECORD;
  session_status text;
  session_type_rec RECORD;
  package_rec RECORD;
  project_type_rec RECORD;
  project_counter integer := 0;
  offset_days integer;
  session_time_value time without time zone;
  project_status_slug text;
  session_status_slug text;
  project_type_slug text;
  session_type_slug text;
  package_slug text;
  reminder_due timestamptz;
  reminder_time_text text;
  reminder_time_value time without time zone;
  deposit_percent numeric;
  deposit_amount numeric;
  blueprint_date_offsets integer[] := ARRAY[-28,-21,-14,-10,-7,-3,0,3,7,14,21,28];
  blueprint_times text[] := ARRAY['09:30','10:00','10:30','11:00','13:30','14:00','15:00','16:00','16:30','17:00'];
  note_payloads jsonb;
  reminder_payloads jsonb;
  activity_row jsonb;
  payment_payloads jsonb;
  payment_row jsonb;
  payment_id uuid;
  deposit_config jsonb;
  existing_seed boolean;
  org_settings_id uuid;
  user_settings_id uuid;
  service_payloads jsonb;
  service_obj jsonb;
  service_id uuid;
  service_slug text;
  service_map jsonb := '{}'::jsonb;
  session_type_payloads jsonb;
  session_type_obj jsonb;
  session_type_id uuid;
  package_payloads jsonb;
  package_obj jsonb;
  line_items jsonb;
  add_on_ids text[];
  line_item_obj jsonb;
  line_item_slug text;
  line_item_role text;
  line_item_qty integer;
  package_pricing_metadata jsonb;
  package_applicable text[];
  project_map jsonb := '{}'::jsonb;
  session_type_signature_id uuid;
  session_type_lifestyle_id uuid;
  session_type_commercial_id uuid;
  extra_session_payloads jsonb;
  extra_session_obj jsonb;
  extra_session_id uuid;
  extra_project_id uuid;
  extra_lead_id uuid;
  extra_reminder_payloads jsonb;
  extra_reminder_obj jsonb;
  extra_reminder_id uuid;
  today_local date;
  payment_extra_payloads jsonb;
  payment_extra_obj jsonb;
BEGIN
  -- If this seed already ran (tagged via activities.template_slug), skip everything.
  SELECT EXISTS (
    SELECT 1 FROM public.activities WHERE template_slug = 'support_demo_seed'
  ) INTO existing_seed;

  IF existing_seed THEN
    RAISE NOTICE 'Seray demo seed already applied; skipping.';
    RETURN;
  END IF;

  -- Create or reuse the auth user (email confirmed).
  SELECT id
  INTO owner_uuid
  FROM auth.users
  WHERE email = target_email
    AND deleted_at IS NULL
  LIMIT 1;

  IF owner_uuid IS NULL THEN
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      target_email,
      '$2b$10$TYU7SjYICavt8gQiT4.fC.nGcU55nyusZmfM/G6zT0hL0S8Cm.oRe',
      now_utc,
      now_utc,
      now_utc,
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('full_name', target_full_name, 'organization_name', target_org_name),
      'authenticated',
      'authenticated',
      now_utc,
      now_utc
    )
    RETURNING id INTO owner_uuid;
  END IF;

  -- Ensure an organization exists for the owner.
  SELECT id
  INTO org_id
  FROM public.organizations
  WHERE public.organizations.owner_id = owner_uuid
  ORDER BY created_at DESC
  LIMIT 1;

  IF org_id IS NULL THEN
    INSERT INTO public.organizations (id, owner_id, name, created_at, updated_at)
    VALUES (gen_random_uuid(), owner_uuid, target_org_name, now_utc, now_utc)
    RETURNING id INTO org_id;
  END IF;

  -- Make sure membership exists and is active for policies.
  IF to_regclass('public.organization_members') IS NOT NULL THEN
    INSERT INTO public.organization_members (
      organization_id,
      user_id,
      system_role,
      role,
      status,
      joined_at,
      created_at,
      updated_at
    )
    VALUES (
      org_id,
      owner_uuid,
      'Owner',
      'Owner',
      'active',
      now_utc,
      now_utc,
      now_utc
    )
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET status = 'active',
        system_role = 'Owner',
        role = 'Owner',
        updated_at = EXCLUDED.updated_at;
  END IF;

  -- Ensure settings exist and are localized.
  SELECT public.ensure_user_settings(owner_uuid) INTO user_settings_id;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'active_organization_id'
  ) THEN
    UPDATE public.user_settings
    SET active_organization_id = org_id
    WHERE public.user_settings.user_id = owner_uuid;
  END IF;

  SELECT public.ensure_organization_settings(org_id, tz, '24-hour', locale)
  INTO org_settings_id;

  UPDATE public.organization_settings
  SET timezone = tz,
      time_format = '24-hour',
      preferred_locale = locale,
      date_format = 'DD/MM/YYYY',
      profile_intake_completed_at = COALESCE(profile_intake_completed_at, now_utc),
      seed_sample_data_onboarding = false
  WHERE organization_id = org_id;

  -- Mark intake seeding queue as processed so onboarding gating is skipped.
  INSERT INTO public.intake_seeding_queue (organization_id, seed_sample_data, created_at, processed_at)
  VALUES (org_id, false, now_utc, now_utc)
  ON CONFLICT (organization_id) DO UPDATE
  SET processed_at = EXCLUDED.processed_at,
      seed_sample_data = EXCLUDED.seed_sample_data;

  -- Ensure all defaults are present for this org.
  PERFORM public.ensure_default_project_types_for_org(owner_uuid, org_id, NULL, locale, true);
  PERFORM public.ensure_default_lead_statuses_for_org(owner_uuid, org_id);
  PERFORM public.ensure_default_project_statuses_for_org(owner_uuid, org_id);
  PERFORM public.ensure_default_session_statuses(owner_uuid, org_id);
  PERFORM public.ensure_default_services_for_org(owner_uuid, org_id);
  PERFORM public.ensure_default_session_types_for_org(owner_uuid, org_id);
  PERFORM public.ensure_default_packages_for_org(owner_uuid, org_id);
  PERFORM public.ensure_default_message_templates(owner_uuid, org_id);
  PERFORM public.ensure_default_session_reminder_workflows(owner_uuid, org_id);
  PERFORM public.ensure_default_delivery_methods_for_org(owner_uuid, org_id);
  PERFORM public.ensure_default_workflows_for_org(owner_uuid, org_id);

  -- Create demo services (idempotent).
  service_payloads := jsonb_build_array(
    jsonb_build_object('slug','demo_lead_photographer','name','Kıdemli Fotoğrafçı','category','Ekip','description','Tam gün lider fotoğrafçı','price',6500,'cost',2200,'extra',false),
    jsonb_build_object('slug','demo_second_shooter','name','İkinci Fotoğrafçı','category','Ekip','description','Paralel çekim desteği','price',3500,'cost',1200,'extra',false),
    jsonb_build_object('slug','demo_filmmaker','name','Videograf','category','Ekip','description','Kısa film ve highlight çekimi','price',5200,'cost',2000,'extra',true),
    jsonb_build_object('slug','demo_album_premium','name','Premium Albüm','category','Teslimatlar','description','30x30 deri albüm, 30 yaprak','price',3200,'cost',1500,'extra',false),
    jsonb_build_object('slug','demo_wall_print','name','Duvar Baskısı','category','Teslimatlar','description','50x70 duvar baskısı, çerçeveli','price',1400,'cost',450,'extra',false),
    jsonb_build_object('slug','demo_drone','name','Drone Çekimi','category','Ekstra','description','Hava çekimi (1 saat)','price',1800,'cost',800,'extra',true),
    jsonb_build_object('slug','demo_color_grading','name','Renk Düzenleme','category','Post Prod','description','Gelişmiş renk ve ton düzenleme','price',900,'cost',250,'extra',true),
    jsonb_build_object('slug','demo_slideshow','name','Slayt Gösterisi','category','Teslimatlar','description','Müzikli slideshow video','price',950,'cost',400,'extra',true)
  );

  FOR service_obj IN SELECT * FROM jsonb_array_elements(service_payloads)
  LOOP
    service_slug := service_obj->>'slug';
    SELECT id INTO service_id
    FROM public.services
    WHERE organization_id = org_id
      AND template_slug = service_slug
    LIMIT 1;

    IF service_id IS NULL THEN
      INSERT INTO public.services (
        id,
        organization_id,
        user_id,
        template_slug,
        name,
        category,
        description,
        price,
        selling_price,
        cost_price,
        extra,
        is_sample,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      org_id,
      owner_uuid,
      service_slug,
      service_obj->>'name',
        service_obj->>'category',
        service_obj->>'description',
        (service_obj->>'price')::numeric,
        (service_obj->>'price')::numeric,
        (service_obj->>'cost')::numeric,
        (service_obj->>'extra')::boolean,
        false,
        now_utc,
        now_utc
      )
      RETURNING id INTO service_id;
    END IF;

    IF service_id IS NOT NULL THEN
      service_map := service_map || jsonb_build_object(service_slug, service_id::text);
    END IF;
  END LOOP;

  -- Create demo session types (idempotent).
  session_type_payloads := jsonb_build_array(
    jsonb_build_object('slug','demo_signature_session','name','Signature Çekim','description','120 dk hikaye anlatımı','duration',120,'category','Signature'),
    jsonb_build_object('slug','demo_lifestyle_session','name','Lifestyle Çekim','description','75 dk aile/portre','duration',75,'category','Lifestyle'),
    jsonb_build_object('slug','demo_commercial_session','name','Kurumsal Çekim','description','90 dk marka/ürün odaklı','duration',90,'category','Commercial')
  );

  FOR session_type_obj IN SELECT * FROM jsonb_array_elements(session_type_payloads)
  LOOP
    SELECT id INTO session_type_id
    FROM public.session_types
    WHERE organization_id = org_id
      AND template_slug = session_type_obj->>'slug'
    LIMIT 1;

    IF session_type_id IS NULL THEN
      INSERT INTO public.session_types (
        id,
        organization_id,
        user_id,
        template_slug,
        name,
        description,
        category,
        duration_minutes,
        is_active,
        sort_order,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      org_id,
      owner_uuid,
      session_type_obj->>'slug',
        session_type_obj->>'name',
        session_type_obj->>'description',
        session_type_obj->>'category',
        COALESCE((session_type_obj->>'duration')::int, 60),
        true,
        10,
        now_utc,
        now_utc
      );
    END IF;
  END LOOP;

  -- Create demo packages (idempotent).
  package_payloads := jsonb_build_array(
    jsonb_build_object(
      'slug','demo_wedding_signature',
      'name','Signature Düğün Paketi',
      'description','Tam gün düğün hikayesi + ekip + albüm',
      'price',18500,
      'applicable_types', ARRAY['wedding','birth'],
      'line_items', jsonb_build_array(
        jsonb_build_object('serviceSlug','demo_lead_photographer','role','base','quantity',1),
        jsonb_build_object('serviceSlug','demo_second_shooter','role','base','quantity',1),
        jsonb_build_object('serviceSlug','demo_filmmaker','role','addon','quantity',1),
        jsonb_build_object('serviceSlug','demo_album_premium','role','addon','quantity',1),
        jsonb_build_object('serviceSlug','demo_drone','role','addon','quantity',1)
      ),
      'deposit_percent',40
    ),
    jsonb_build_object(
      'slug','demo_family_story',
      'name','Aile Lifestyle Paketi',
      'description','Açık hava veya evde lifestyle çekim + baskılar',
      'price',6200,
      'applicable_types', ARRAY['family','children','newborn','maternity'],
      'line_items', jsonb_build_array(
        jsonb_build_object('serviceSlug','demo_lead_photographer','role','base','quantity',1),
        jsonb_build_object('serviceSlug','demo_color_grading','role','base','quantity',1),
        jsonb_build_object('serviceSlug','demo_wall_print','role','addon','quantity',1),
        jsonb_build_object('serviceSlug','demo_slideshow','role','addon','quantity',1),
        jsonb_build_object('serviceSlug','demo_second_shooter','role','addon','quantity',1)
      ),
      'deposit_percent',30
    ),
    jsonb_build_object(
      'slug','demo_brand_launch',
      'name','Marka Lansman Paketi',
      'description','Kurumsal/ürün lansmanı için çekim + teslimatlar',
      'price',9800,
      'applicable_types', ARRAY['commercial','event','real_estate'],
      'line_items', jsonb_build_array(
        jsonb_build_object('serviceSlug','demo_lead_photographer','role','base','quantity',1),
        jsonb_build_object('serviceSlug','demo_second_shooter','role','base','quantity',1),
        jsonb_build_object('serviceSlug','demo_color_grading','role','base','quantity',1),
        jsonb_build_object('serviceSlug','demo_filmmaker','role','addon','quantity',1),
        jsonb_build_object('serviceSlug','demo_drone','role','addon','quantity',1)
      ),
      'deposit_percent',35
    )
  );

  FOR package_obj IN SELECT * FROM jsonb_array_elements(package_payloads)
  LOOP
    SELECT id INTO package_rec
    FROM public.packages
    WHERE organization_id = org_id
      AND template_slug = package_obj->>'slug'
    LIMIT 1;

    IF package_rec.id IS NOT NULL THEN
      CONTINUE;
    END IF;

    add_on_ids := ARRAY[]::text[];
    line_items := '[]'::jsonb;
    package_applicable := ARRAY[]::text[];

    SELECT array_agg(value::text)
    INTO package_applicable
    FROM jsonb_array_elements_text(package_obj->'applicable_types');
    package_applicable := COALESCE(package_applicable, ARRAY[]::text[]);

    FOR line_item_obj IN SELECT * FROM jsonb_array_elements(package_obj->'line_items')
    LOOP
      line_item_slug := line_item_obj->>'serviceSlug';
      line_item_role := COALESCE(line_item_obj->>'role', 'base');
      line_item_qty := COALESCE((line_item_obj->>'quantity')::int, 1);

      SELECT (service_map ->> line_item_slug)::uuid INTO service_id;
      IF service_id IS NULL THEN
        CONTINUE;
      END IF;

      line_items := line_items || jsonb_build_array(
        jsonb_build_object(
          'serviceId', service_id::text,
          'role', line_item_role,
          'quantity', line_item_qty
        )
      );

      IF line_item_role = 'addon' THEN
        add_on_ids := array_append(add_on_ids, service_id::text);
      END IF;
    END LOOP;

    package_pricing_metadata := jsonb_build_object(
      'enableDeposit', true,
      'depositMode', 'percent_base',
      'depositValue', COALESCE((package_obj->>'deposit_percent')::numeric, 30),
      'depositTarget', 'base',
      'depositAmount', NULL,
      'packageVatRate', NULL,
      'packageVatMode', 'exclusive',
      'packageVatOverrideEnabled', false,
      'basePriceInput', (package_obj->>'price')::numeric
    );

    INSERT INTO public.packages (
      user_id,
      organization_id,
      template_slug,
      name,
      description,
      price,
      client_total,
      applicable_types,
      default_add_ons,
      line_items,
      is_active,
      delivery_estimate_type,
      delivery_photo_count_min,
      delivery_photo_count_max,
      delivery_lead_time_value,
      delivery_lead_time_unit,
      delivery_methods,
      include_addons_in_price,
      pricing_metadata
    ) VALUES (
      owner_uuid,
      org_id,
      package_obj->>'slug',
      package_obj->>'name',
      package_obj->>'description',
      (package_obj->>'price')::numeric,
      (package_obj->>'price')::numeric,
      package_applicable,
      add_on_ids,
      line_items,
      true,
      'single',
      NULL,
      NULL,
      NULL,
      NULL,
      '[]'::jsonb,
      true,
      package_pricing_metadata
    );
  END LOOP;

  -- Leads (12).
  lead_payloads := jsonb_build_array(
    jsonb_build_object('key','wedding_bosphorus','name','Ayşe Demir','email','ayse.demir@storylane.co','phone','+90 532 000 1001','status_slug','new','notes','Expo standında tanışıldı, hızlı dönüş bekliyor.'),
    jsonb_build_object('key','family_moda','name','Deniz & Ece Yılmaz','email','deniz.ece@familia.com','phone','+90 532 000 1002','status_slug','proposal','notes','Açık hava lifestyle için fiyat aldı, teklif gönderildi.'),
    jsonb_build_object('key','commercial_launch','name','Mert Kalkan','email','mert@brandspace.com','phone','+90 532 000 1003','status_slug','negotiation','notes','Ürün lansmanı için kapsam netleştiriliyor.'),
    jsonb_build_object('key','newborn_home','name','Selin Aksoy','email','selin.aksoy@homebirth.co','phone','+90 532 000 1004','status_slug','qualified','notes','Ebe randevusu alındı, çekim tarihi arıyor.'),
    jsonb_build_object('key','children_milestone','name','Elif Aras','email','elif.aras@milestone.co','phone','+90 532 000 1005','status_slug','qualified','notes','1 yaş doğum günü için konsept arıyor.'),
    jsonb_build_object('key','maternity_sunset','name','Büşra Güneş','email','busra.gunes@sundown.me','phone','+90 532 000 1006','status_slug','proposal','notes','Kıyafet seçimi için moodboard istedi.'),
    jsonb_build_object('key','birth_oncall','name','Derya & Kerem','email','derya.kerem@oncall.co','phone','+90 532 000 1007','status_slug','won','notes','Avans onaylandı, on-call plan yapılıyor.'),
    jsonb_build_object('key','headshot_team','name','Seda Karaca','email','seda@proportrait.co','phone','+90 532 000 1008','status_slug','new','notes','Ekip için stüdyo portre talep etti.'),
    jsonb_build_object('key','event_congress','name','Haluk Öz','email','haluk.oz@eventify.co','phone','+90 532 000 1009','status_slug','negotiation','notes','Program akışı bekleniyor, ön ödeme konuşuldu.'),
    jsonb_build_object('key','realestate_villa','name','Canan Topçu','email','canan.topcu@homespot.co','phone','+90 532 000 1010','status_slug','proposal','notes','Villa çekimi için iki tarih paylaşıldı.'),
    jsonb_build_object('key','senior_grad','name','Zeynep Koç','email','zeynep.koc@gradstory.co','phone','+90 532 000 1011','status_slug','won','notes','Ödeme planı onaylandı, tarih seçecek.'),
    jsonb_build_object('key','pet_session','name','Kaan & Lila','email','kaan.lila@pawsome.co','phone','+90 532 000 1012','status_slug','lost','notes','Rakip paket daha hızlı teslim süresi sundu.')
    ,
    jsonb_build_object('key','hotel_event','name','Lara Hotel','email','pro@larahotel.com','phone','+90 532 000 1013','status_slug','new','notes','Kurumsal gala için teklif istedi.'),
    jsonb_build_object('key','creative_agency','name','Studio Nova','email','hello@studionova.co','phone','+90 532 000 1014','status_slug','won','notes','Ajans retouching paketi onayladı.')
  );

  FOR lead_row IN SELECT * FROM jsonb_array_elements(lead_payloads)
  LOOP
    lead_id := gen_random_uuid();
    lead_status_slug := COALESCE(lead_row->>'status_slug', 'new');
    -- Map custom slugs to existing defaults.
    mapped_lead_status_slug := CASE lower(lead_status_slug)
      WHEN 'new' THEN 'new'
      WHEN 'proposal' THEN 'qualified'
      WHEN 'negotiation' THEN 'qualified'
      WHEN 'won' THEN 'booked'
      WHEN 'lost' THEN 'lost'
      ELSE 'new'
    END;

    SELECT id, name
    INTO lead_status_rec
    FROM public.lead_statuses
    WHERE organization_id = org_id
      AND (
        lower(template_slug) = mapped_lead_status_slug
        OR lower(name) = mapped_lead_status_slug
      )
    ORDER BY sort_order
    LIMIT 1;

    IF lead_status_rec.id IS NULL THEN
      SELECT id, name
      INTO lead_status_rec
      FROM public.lead_statuses
      WHERE organization_id = org_id
      ORDER BY sort_order
      LIMIT 1;
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
      lead_row->>'name',
      lead_row->>'email',
      lead_row->>'phone',
      COALESCE(lead_status_rec.name, initcap(mapped_lead_status_slug)),
      lead_status_rec.id,
      lead_row->>'notes',
      now_utc,
      now_utc
    );

    lead_map := lead_map || jsonb_build_object(lead_row->>'key', lead_id::text);
  END LOOP;

  -- Projects + Sessions (10 projects, 9 sessions).
  project_payloads := jsonb_build_array(
    jsonb_build_object('key','wedding_bosphorus','lead_key','wedding_bosphorus','project_type','wedding','package','demo_wedding_signature','project_status','in_progress','session_type','demo_signature_session','session_status','planned','title','Boğaz Düğünü','session_label','Düğün Çekimi','location','Moda Sahili','notes','Çekim listesi onaylandı, prova günü bekleniyor.','reminder','Prova tarihi teyidi al.','reminder_offset',5,'reminder_time','10:00','base_price',18500),
    jsonb_build_object('key','family_moda','lead_key','family_moda','project_type','family','package','demo_family_story','project_status','proposal','session_type','demo_lifestyle_session','session_status','planned','title','Moda Aile Lifestyle','session_label','Aile Lifestyle','location','Moda Sahili','notes','Aile kıyafetleri seçiliyor.','reminder','Konum ve hava durumu paylaş.','reminder_offset',3,'reminder_time','11:00','base_price',6200),
    jsonb_build_object('key','commercial_launch','lead_key','commercial_launch','project_type','commercial','package','demo_brand_launch','project_status','proposal','session_type','demo_commercial_session','session_status','planned','title','Marka Lansman','session_label','Kampanya Çekimi','location','Maslak Ofis Bölgesi','notes','Storyboard bekleniyor.','reminder','Ürün teslim teyidi al.','reminder_offset',4,'reminder_time','09:30','base_price',9800),
    jsonb_build_object('key','newborn_home','lead_key','newborn_home','project_type','newborn','package','demo_family_story','project_status','planned','session_type','demo_lifestyle_session','session_status','planned','title','Yenidoğan Belgeseli','session_label','Yenidoğan Ev Çekimi','location','Kadıköy Stüdyosu','notes','Stüdyo ısısı ve aksesuarlar hazır.','reminder','Adres ve park bilgisi iste.','reminder_offset',2,'reminder_time','12:00','base_price',6200),
    jsonb_build_object('key','children_milestone','lead_key','children_milestone','project_type','children','package','demo_family_story','project_status','planned','session_type','demo_lifestyle_session','session_status','planned','title','1 Yaş Milestone','session_label','Milestone Çekimi','location','Etiler Stüdyosu','notes','Balonlar ve arka plan hazırlandı.','reminder','Parti zaman akışını paylaş.','reminder_offset',6,'reminder_time','14:30','base_price',6200),
    jsonb_build_object('key','maternity_sunset','lead_key','maternity_sunset','project_type','maternity','package','demo_wedding_signature','project_status','in_progress','session_type','demo_signature_session','session_status','planned','title','Gün Batımı Hamilelik','session_label','Hamilelik Çekimi','location','Heybeliada Sahili','notes','Elbise provası tamam.','reminder','Saç-makyaj saatlerini kilitle.','reminder_offset',7,'reminder_time','09:45','base_price',18500),
    jsonb_build_object('key','birth_oncall','lead_key','birth_oncall','project_type','birth','package','demo_wedding_signature','project_status','in_progress','session_type','demo_signature_session','session_status','planned','title','Doğum Hikayesi','session_label','On-Call Doğum','location','Şişli Hastane Bölgesi','notes','Hastane erişimi onaylandı.','reminder','Gece çantası kontrolü yap.','reminder_offset',1,'reminder_time','16:30','base_price',18500),
    jsonb_build_object('key','event_congress','lead_key','event_congress','project_type','event','package','demo_brand_launch','project_status','in_progress','session_type','demo_commercial_session','session_status','planned','title','Kongre Belgeleme','session_label','Etkinlik Çekimi','location','Haliç Kongre Merkezi','notes','Program akışı paylaşıldı.','reminder','Konuşmacı saatlerini kesinleştir.','reminder_offset',8,'reminder_time','13:00','base_price',9800),
    jsonb_build_object('key','realestate_villa','lead_key','realestate_villa','project_type','real_estate','package','demo_brand_launch','project_status','proposal','session_type','demo_commercial_session','session_status','planned','title','Villa Çekimi','session_label','Gayrimenkul Çekimi','location','Çengelköy Tepesi','notes','Plan ve kat çizimleri alındı.','reminder','Temizlik firmasıyla teyit.','reminder_offset',3,'reminder_time','09:00','base_price',6200),
    jsonb_build_object('key','senior_grad','lead_key','senior_grad','project_type','senior','package','demo_family_story','project_status','completed','session_type','demo_lifestyle_session','session_status','completed','title','Mezuniyet Hikayesi','session_label','Mezuniyet Çekimi','location','Galata Meydanı','notes','Çekim teslim edildi, baskılar sırada.','reminder','Baskı teslim tarihini bildir.','reminder_offset',2,'reminder_time','10:15','base_price',6200)
  );

  FOR project_row IN SELECT * FROM jsonb_array_elements(project_payloads)
  LOOP
    project_counter := project_counter + 1;
    offset_days := blueprint_date_offsets[project_counter];
    session_time_value := blueprint_times[MOD(project_counter - 1, array_length(blueprint_times, 1)) + 1]::time;

    project_type_slug := project_row->>'project_type';
    session_type_slug := COALESCE(project_row->>'session_type', 'signature_session');
    package_slug := COALESCE(project_row->>'package', 'wedding_story');
    project_status_slug := COALESCE(project_row->>'project_status', 'in_progress');
    session_status_slug := COALESCE(project_row->>'session_status', 'planned');

    SELECT id INTO project_type_rec
    FROM public.project_types
    WHERE organization_id = org_id
      AND template_slug = project_type_slug
    ORDER BY sort_order
    LIMIT 1;

    SELECT id, name INTO project_status_rec
    FROM public.project_statuses
    WHERE organization_id = org_id
      AND template_slug = project_status_slug
    ORDER BY sort_order
    LIMIT 1;

    SELECT id INTO session_type_rec
    FROM public.session_types
    WHERE organization_id = org_id
      AND template_slug = session_type_slug
    LIMIT 1;

    SELECT id, price INTO package_rec
    FROM public.packages
    WHERE organization_id = org_id
      AND template_slug = package_slug
    LIMIT 1;

    IF project_type_rec.id IS NULL OR project_status_rec.id IS NULL OR session_type_rec.id IS NULL OR package_rec.id IS NULL THEN
      CONTINUE;
    END IF;

    lead_id := (lead_map ->> (project_row->>'lead_key'))::uuid;
    IF lead_id IS NULL THEN
      CONTINUE;
    END IF;

    project_id := gen_random_uuid();
    session_id := gen_random_uuid();
    activity_note_id := gen_random_uuid();
    activity_reminder_id := gen_random_uuid();

    deposit_percent := CASE package_slug
      WHEN 'mini_lifestyle' THEN 30
      WHEN 'wedding_story' THEN 40
      ELSE 25
    END;

    deposit_amount := round(COALESCE(package_rec.price, (project_row->>'base_price')::numeric) * deposit_percent / 100.0, 2);

    deposit_config := jsonb_build_object(
      'mode', 'percent_base',
      'value', deposit_percent,
      'description', 'Kapora (%' || deposit_percent || ')',
      'snapshot_amount', deposit_amount,
      'snapshot_total', COALESCE(package_rec.price, (project_row->>'base_price')::numeric),
      'snapshot_locked_at', to_char(now_utc, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'snapshot_note', 'Demo kapora planı'
    );

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
      lead_id,
      project_row->>'title',
      project_row->>'notes',
      project_status_rec.id,
      project_type_rec.id,
      package_rec.id,
      COALESCE(package_rec.price, (project_row->>'base_price')::numeric),
      deposit_config,
      now_utc,
      now_utc
    );

    project_map := project_map || jsonb_build_object(project_row->>'key', project_id::text);

    -- Sessions (skip one to hit 9 sessions total).
    IF project_counter <= 9 THEN
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
        lead_id,
        project_id,
        session_type_rec.id,
        project_row->>'session_label',
        (base_local + (offset_days || ' days')::interval)::date,
        session_time_value,
        session_status_slug,
        project_row->>'location',
        project_row->>'notes',
        now_utc,
        now_utc
      );
    END IF;

    -- Note activity (first 9 projects).
    IF project_counter <= 9 THEN
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
        lead_id,
        project_id,
        'note',
        project_row->>'notes',
        NULL,
        NULL,
        NULL,
        'support_demo_seed',
        now_utc,
        now_utc
      );
    END IF;

    -- Reminder activity (first 8 projects).
    IF project_counter <= 8 THEN
      reminder_time_text := COALESCE(project_row->>'reminder_time', '10:00');
      reminder_time_value := reminder_time_text::time;
      reminder_due := (base_local + (offset_days || ' days')::interval) AT TIME ZONE tz + (COALESCE((project_row->>'reminder_offset')::int, 3) || ' days')::interval;

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
        lead_id,
        project_id,
        'reminder',
        project_row->>'reminder',
        reminder_due,
        reminder_time_value,
        false,
        'support_demo_seed',
        now_utc,
        now_utc
      );
    END IF;
  END LOOP;

  -- Extra sessions to enrich today's schedule.
  SELECT id INTO session_type_signature_id
  FROM public.session_types
  WHERE organization_id = org_id AND template_slug = 'demo_signature_session'
  LIMIT 1;
  SELECT id INTO session_type_lifestyle_id
  FROM public.session_types
  WHERE organization_id = org_id AND template_slug = 'demo_lifestyle_session'
  LIMIT 1;
  SELECT id INTO session_type_commercial_id
  FROM public.session_types
  WHERE organization_id = org_id AND template_slug = 'demo_commercial_session'
  LIMIT 1;

  today_local := base_local::date;

  extra_session_payloads := jsonb_build_array(
    jsonb_build_object('project_key','wedding_bosphorus','session_type_id',session_type_signature_id,'label','Sabah Çekimi - Moda','location','Moda Sahili','date',today_local::text,'time','10:00','status','planned'),
    jsonb_build_object('project_key','commercial_launch','session_type_id',session_type_commercial_id,'label','Stüdyo Kampanya Çekimi','location','Levent Stüdyo','date',today_local::text,'time','13:00','status','planned'),
    jsonb_build_object('project_key','family_moda','session_type_id',session_type_lifestyle_id,'label','Aile Planlama Toplantısı','location','Online','date',(today_local + 1)::text,'time','16:00','status','planned')
  );

  FOR extra_session_obj IN SELECT * FROM jsonb_array_elements(extra_session_payloads)
  LOOP
    SELECT (project_map ->> (extra_session_obj->>'project_key'))::uuid INTO extra_project_id;
    IF extra_project_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT p.lead_id INTO extra_lead_id
    FROM public.projects p
    WHERE p.id = extra_project_id
    LIMIT 1;

    IF extra_lead_id IS NULL THEN
      CONTINUE;
    END IF;

    extra_session_id := gen_random_uuid();

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
      extra_session_id,
      org_id,
      owner_uuid,
      extra_lead_id,
      extra_project_id,
      NULLIF(extra_session_obj->>'session_type_id','')::uuid,
      extra_session_obj->>'label',
      (extra_session_obj->>'date')::date,
      (extra_session_obj->>'time')::time,
      extra_session_obj->>'status',
      extra_session_obj->>'location',
      'Plan güncellendi.',
      now_utc,
      now_utc
    );
  END LOOP;

  -- Extra reminders (today/tomorrow + one overdue).
  extra_reminder_payloads := jsonb_build_array(
    jsonb_build_object('project_key','wedding_bosphorus','lead_key','wedding_bosphorus','content','Bugün prova saatini teyit et.','days_offset',0,'time','09:15','completed',false),
    jsonb_build_object('project_key','commercial_launch','lead_key','commercial_launch','content','Storyboard teslimini al ve paylaş.','days_offset',1,'time','11:00','completed',false),
    jsonb_build_object('project_key','family_moda','lead_key','family_moda','content','Dünkü çekim notlarını müşteriye gönder.','days_offset',-1,'time','17:30','completed',false)
  );

  FOR extra_reminder_obj IN SELECT * FROM jsonb_array_elements(extra_reminder_payloads)
  LOOP
    SELECT (project_map ->> (extra_reminder_obj->>'project_key'))::uuid INTO extra_project_id;
    IF extra_project_id IS NULL THEN
      CONTINUE;
    END IF;

    extra_lead_id := (lead_map ->> (extra_reminder_obj->>'lead_key'))::uuid;
    IF extra_lead_id IS NULL THEN
      CONTINUE;
    END IF;

    extra_reminder_id := gen_random_uuid();

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
      extra_reminder_id,
      org_id,
      owner_uuid,
      extra_lead_id,
      extra_project_id,
      'reminder',
      extra_reminder_obj->>'content',
      today_local + COALESCE((extra_reminder_obj->>'days_offset')::int, 0),
      (extra_reminder_obj->>'time')::time,
      COALESCE((extra_reminder_obj->>'completed')::boolean, false),
      'support_demo_seed',
      now_utc,
      now_utc
    );
  END LOOP;

  -- Payments mix (6 entries).
  payment_payloads := jsonb_build_array(
    jsonb_build_object('project_key','wedding_bosphorus','amount',7400,'type','deposit_payment','status','paid','entry_kind','recorded','description','Kapora ödemesi alındı.','days_offset',-20),
    jsonb_build_object('project_key','wedding_bosphorus','amount',11100,'type','manual','status','due','entry_kind','scheduled','description','Kalan bakiye (düğün)','days_offset',10),
    jsonb_build_object('project_key','family_moda','amount',1560,'type','deposit_payment','status','paid','entry_kind','recorded','description','Aile çekimi kaporası','days_offset',-7),
    jsonb_build_object('project_key','commercial_launch','amount',5000,'type','manual','status','due','entry_kind','scheduled','description','Lansman çekimi kapora/bakiye','days_offset',5),
    jsonb_build_object('project_key','event_congress','amount',3920,'type','deposit_payment','status','paid','entry_kind','recorded','description','Etkinlik avansı','days_offset',-5),
    jsonb_build_object('project_key','senior_grad','amount',4500,'type','manual','status','paid','entry_kind','recorded','description','Mezuniyet çekimi tam ödeme','days_offset',-2)
  );
  payment_extra_payloads := jsonb_build_array(
    jsonb_build_object('project_key','wedding_bosphorus','amount',5200,'type','deposit_payment','status','paid','entry_kind','recorded','description','Ek kapora ödendi','days_offset',-3),
    jsonb_build_object('project_key','commercial_launch','amount',4600,'type','manual','status','due','entry_kind','scheduled','description','Kalan bakiye (lansman)','days_offset',7)
  );

  FOR payment_row IN SELECT * FROM jsonb_array_elements(payment_payloads)
  LOOP
    -- Find project id by key.
    SELECT id INTO project_id
    FROM public.projects
    WHERE organization_id = org_id
      AND name = (
        SELECT pr->>'title'
        FROM jsonb_array_elements(project_payloads) AS pr
        WHERE pr->>'key' = payment_row->>'project_key'
        LIMIT 1
      )
    LIMIT 1;

    IF project_id IS NULL THEN
      CONTINUE;
    END IF;

    payment_id := gen_random_uuid();

    INSERT INTO public.payments (
      id,
      project_id,
      organization_id,
      user_id,
      amount,
      description,
      status,
      type,
      entry_kind,
      scheduled_initial_amount,
      scheduled_remaining_amount,
      deposit_allocation,
      date_paid,
      created_at,
      updated_at
    ) VALUES (
      payment_id,
      project_id,
      org_id,
      owner_uuid,
      (payment_row->>'amount')::numeric,
      payment_row->>'description',
      payment_row->>'status',
      payment_row->>'type',
      payment_row->>'entry_kind',
      CASE WHEN payment_row->>'entry_kind' = 'scheduled' THEN (payment_row->>'amount')::numeric END,
      CASE WHEN payment_row->>'entry_kind' = 'scheduled' THEN (payment_row->>'amount')::numeric END,
      CASE WHEN payment_row->>'type' = 'deposit_payment' THEN (payment_row->>'amount')::numeric ELSE 0 END,
      (base_local + (COALESCE((payment_row->>'days_offset')::int, 0) || ' days')::interval)::date,
      now_utc,
      now_utc
    );
  END LOOP;

  FOR payment_extra_obj IN SELECT * FROM jsonb_array_elements(payment_extra_payloads)
  LOOP
    SELECT (project_map ->> (payment_extra_obj->>'project_key'))::uuid INTO extra_project_id;
    IF extra_project_id IS NULL THEN
      CONTINUE;
    END IF;

    payment_id := gen_random_uuid();

    INSERT INTO public.payments (
      id,
      project_id,
      organization_id,
      user_id,
      amount,
      description,
      status,
      type,
      entry_kind,
      scheduled_initial_amount,
      scheduled_remaining_amount,
      deposit_allocation,
      date_paid,
      created_at,
      updated_at
    ) VALUES (
      payment_id,
      extra_project_id,
      org_id,
      owner_uuid,
      (payment_extra_obj->>'amount')::numeric,
      payment_extra_obj->>'description',
      payment_extra_obj->>'status',
      payment_extra_obj->>'type',
      payment_extra_obj->>'entry_kind',
      CASE WHEN payment_extra_obj->>'entry_kind' = 'scheduled' THEN (payment_extra_obj->>'amount')::numeric END,
      CASE WHEN payment_extra_obj->>'entry_kind' = 'scheduled' THEN (payment_extra_obj->>'amount')::numeric END,
      CASE WHEN payment_extra_obj->>'type' = 'deposit_payment' THEN (payment_extra_obj->>'amount')::numeric ELSE 0 END,
      (base_local + (COALESCE((payment_extra_obj->>'days_offset')::int, 0) || ' days')::interval)::date,
      now_utc,
      now_utc
    );
  END LOOP;
END;
$$;
