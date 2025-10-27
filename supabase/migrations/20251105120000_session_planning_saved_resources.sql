-- Session planning saved locations
CREATE TABLE IF NOT EXISTS public.session_saved_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid,
  label text NOT NULL,
  address text NOT NULL,
  meeting_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.session_saved_locations
  ADD CONSTRAINT session_saved_locations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.session_saved_locations
  ADD CONSTRAINT session_saved_locations_org_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_session_saved_locations_user_id
  ON public.session_saved_locations (user_id);

CREATE INDEX IF NOT EXISTS idx_session_saved_locations_org_id
  ON public.session_saved_locations (organization_id);

ALTER TABLE public.session_saved_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their saved locations"
ON public.session_saved_locations
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert saved locations"
ON public.session_saved_locations
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their saved locations"
ON public.session_saved_locations
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their saved locations"
ON public.session_saved_locations
FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_session_saved_locations_updated_at
  BEFORE UPDATE ON public.session_saved_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Session planning saved note presets
CREATE TABLE IF NOT EXISTS public.session_saved_note_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.session_saved_note_presets
  ADD CONSTRAINT session_saved_note_presets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.session_saved_note_presets
  ADD CONSTRAINT session_saved_note_presets_org_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_session_saved_note_presets_user_id
  ON public.session_saved_note_presets (user_id);

CREATE INDEX IF NOT EXISTS idx_session_saved_note_presets_org_id
  ON public.session_saved_note_presets (organization_id);

ALTER TABLE public.session_saved_note_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their note presets"
ON public.session_saved_note_presets
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert note presets"
ON public.session_saved_note_presets
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their note presets"
ON public.session_saved_note_presets
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their note presets"
ON public.session_saved_note_presets
FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_session_saved_note_presets_updated_at
  BEFORE UPDATE ON public.session_saved_note_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
