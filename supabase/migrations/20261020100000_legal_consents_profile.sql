-- Store accepted legal versions on profiles and capture them during signup.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS legal_consents jsonb;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  consents jsonb;
BEGIN
  consents := NULLIF(NEW.raw_user_meta_data -> 'legal_consents', 'null'::jsonb);

  INSERT INTO public.profiles (user_id, full_name, legal_consents)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', consents)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
