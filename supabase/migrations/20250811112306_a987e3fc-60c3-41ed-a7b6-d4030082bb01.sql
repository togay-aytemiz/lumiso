-- Create table for session statuses
CREATE TABLE IF NOT EXISTS public.session_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_system_initial BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.session_statuses ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own session statuses"
ON public.session_statuses
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own session statuses"
ON public.session_statuses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own session statuses"
ON public.session_statuses
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Prevent deleting system initial rows
CREATE POLICY "Users can delete their own non-system session statuses"
ON public.session_statuses
FOR DELETE
USING (auth.uid() = user_id AND is_system_initial = false);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_session_statuses_updated_at
BEFORE UPDATE ON public.session_statuses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Prevent changing is_system_initial from true to false
CREATE OR REPLACE FUNCTION public.prevent_system_initial_toggle()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_system_initial = true AND NEW.is_system_initial = false THEN
      RAISE EXCEPTION 'The initial system stage cannot be changed to non-system';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

CREATE TRIGGER trg_prevent_system_initial_toggle
BEFORE UPDATE ON public.session_statuses
FOR EACH ROW
EXECUTE FUNCTION public.prevent_system_initial_toggle();

-- Helper function to get default session status (Planned or first)
CREATE OR REPLACE FUNCTION public.get_default_session_status(user_uuid uuid)
RETURNS uuid AS $$
DECLARE
  default_status_id UUID;
BEGIN
  SELECT id INTO default_status_id
  FROM public.session_statuses
  WHERE user_id = user_uuid AND LOWER(name) = 'planned'
  ORDER BY sort_order ASC
  LIMIT 1;

  IF default_status_id IS NULL THEN
    SELECT id INTO default_status_id
    FROM public.session_statuses
    WHERE user_id = user_uuid
    ORDER BY sort_order ASC, created_at ASC
    LIMIT 1;
  END IF;

  RETURN default_status_id;
END;$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';
