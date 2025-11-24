-- Attach support@lumiso.app to the existing Sweet Dreams Photography demo org (Seray seed).
-- If the support user is missing, create it with the provided password.
-- Idempotent: memberships and settings are upserted when tables exist.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  support_email CONSTANT text := 'support@lumiso.app';
  support_full_name CONSTANT text := 'Lumiso Demo';
  support_password_hash CONSTANT text := '$2b$10$TYU7SjYICavt8gQiT4.fC.nGcU55nyusZmfM/G6zT0hL0S8Cm.oRe'; -- support@lumiso.app
  seed_org_name CONSTANT text := 'Sweet Dreams Photography';
  support_id uuid;
  seed_org_id uuid;
BEGIN
  -- Ensure support user exists (auth).
  SELECT id INTO support_id
  FROM auth.users
  WHERE email = support_email
    AND deleted_at IS NULL
  LIMIT 1;

  IF support_id IS NULL THEN
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
    ) VALUES (
      gen_random_uuid(),
      support_email,
      support_password_hash,
      timezone('UTC', now()),
      timezone('UTC', now()),
      timezone('UTC', now()),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('full_name', support_full_name),
      'authenticated',
      'authenticated',
      timezone('UTC', now()),
      timezone('UTC', now())
    )
    RETURNING id INTO support_id;
  ELSE
    UPDATE auth.users
    SET encrypted_password = support_password_hash,
        email_confirmed_at = COALESCE(email_confirmed_at, timezone('UTC', now())),
        updated_at = timezone('UTC', now())
    WHERE id = support_id;
  END IF;

  -- Locate the seeded org (prefer Seray-owned; otherwise match by name).
  SELECT o.id
  INTO seed_org_id
  FROM public.organizations o
  JOIN auth.users u ON u.id = o.owner_id
  WHERE u.email = 'seray@lumiso.app'
  ORDER BY o.created_at DESC
  LIMIT 1;

  IF seed_org_id IS NULL THEN
    SELECT id
    INTO seed_org_id
    FROM public.organizations
    WHERE name = seed_org_name
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- If we still don't have an org, bail quietly.
  IF seed_org_id IS NULL THEN
    RAISE NOTICE 'Seed organization not found; nothing to attach.';
    RETURN;
  END IF;

  -- Add/activate membership for support user.
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
    ) VALUES (
      seed_org_id,
      support_id,
      'Owner',
      'Owner',
      'active',
      timezone('UTC', now()),
      timezone('UTC', now()),
      timezone('UTC', now())
    )
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET status = 'active',
        system_role = 'Owner',
        role = 'Owner',
        updated_at = EXCLUDED.updated_at;
  END IF;

  -- Ensure user_settings points to the demo org when the table/column exist.
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_settings'
  ) THEN
    PERFORM public.ensure_user_settings(support_id);
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_settings'
        AND column_name = 'active_organization_id'
    ) THEN
      UPDATE public.user_settings
      SET active_organization_id = seed_org_id
      WHERE user_id = support_id;
    END IF;
  END IF;
END;
$$;
