-- Ensure the Seray demo auth user exists with the expected password and membership.
-- This is idempotent and only fixes the login/user visibility issue; it does not reseed data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  target_email CONSTANT text := 'seray@lumiso.app';
  target_full_name CONSTANT text := 'Seray';
  target_org_name CONSTANT text := 'Sweet Dreams Photography';
  -- bcrypt hash for password: seray@lumiso.app (cost 10)
  hashed_password CONSTANT text := '$2b$10$u8A0bRfJWkJtg7A85Z9SqOdlmLlaoyOt3Mnp6qzg9H66UV8ui1gGa';
  uid uuid;
  org uuid;
BEGIN
  -- Upsert auth user.
  SELECT id
  INTO uid
  FROM auth.users
  WHERE email = target_email
    AND deleted_at IS NULL
  LIMIT 1;

  IF uid IS NULL THEN
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
      target_email,
      hashed_password,
      timezone('UTC', now()),
      timezone('UTC', now()),
      timezone('UTC', now()),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('full_name', target_full_name, 'organization_name', target_org_name),
      'authenticated',
      'authenticated',
      timezone('UTC', now()),
      timezone('UTC', now())
    )
    RETURNING id INTO uid;
  ELSE
    UPDATE auth.users
    SET encrypted_password = hashed_password,
        email_confirmed_at = timezone('UTC', now()),
        updated_at = timezone('UTC', now())
    WHERE id = uid;
  END IF;

  -- Ensure an organization for the user.
  SELECT id
  INTO org
  FROM public.organizations
  WHERE owner_id = uid
  ORDER BY created_at DESC
  LIMIT 1;

  IF org IS NULL THEN
    INSERT INTO public.organizations (id, owner_id, name, created_at, updated_at)
    VALUES (gen_random_uuid(), uid, target_org_name, timezone('UTC', now()), timezone('UTC', now()))
    RETURNING id INTO org;
  END IF;

  -- Ensure membership is active (if membership table exists).
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
      org,
      uid,
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

  -- Ensure user settings point to the org when the column exists.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_settings'
  ) THEN
    PERFORM public.ensure_user_settings(uid);
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_settings'
        AND column_name = 'active_organization_id'
    ) THEN
      UPDATE public.user_settings
      SET active_organization_id = org
      WHERE user_id = uid;
    END IF;
  END IF;
END;
$$;
