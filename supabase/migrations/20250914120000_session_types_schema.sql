-- Phase 1: Introduce session types and default selection scaffolding

-- 1. Session types table -----------------------------------------------
CREATE TABLE public.session_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization owners can manage session types" ON public.session_types
FOR ALL USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
) WITH CHECK (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
);

CREATE INDEX idx_session_types_org_sort ON public.session_types (organization_id, sort_order, name);
CREATE INDEX idx_session_types_active ON public.session_types (organization_id) WHERE is_active = true;
CREATE UNIQUE INDEX idx_session_types_org_name_lower ON public.session_types (organization_id, lower(name));

CREATE TRIGGER trg_session_types_set_updated_at
BEFORE UPDATE ON public.session_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Link sessions to session types ------------------------------------
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS session_type_id uuid;

ALTER TABLE public.sessions
ADD CONSTRAINT sessions_session_type_id_fkey
FOREIGN KEY (session_type_id)
REFERENCES public.session_types(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_session_type_id ON public.sessions(session_type_id);

-- 3. Store organization default session type ---------------------------
ALTER TABLE public.organization_settings
ADD COLUMN IF NOT EXISTS default_session_type_id uuid;

ALTER TABLE public.organization_settings
ADD CONSTRAINT organization_settings_default_session_type_id_fkey
FOREIGN KEY (default_session_type_id)
REFERENCES public.session_types(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_settings_default_session_type ON public.organization_settings(default_session_type_id);
