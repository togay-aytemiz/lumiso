-- Create delivery_methods table used by ensure_default_delivery_methods_for_org

CREATE TABLE IF NOT EXISTS public.delivery_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

ALTER TABLE public.delivery_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read delivery methods"
  ON public.delivery_methods
  FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM public.organizations
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Org owners can manage delivery methods"
  ON public.delivery_methods
  FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM public.organizations
      WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT id FROM public.organizations
      WHERE owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_delivery_methods_org_sort
  ON public.delivery_methods (organization_id, sort_order, slug);

CREATE TRIGGER trg_delivery_methods_updated_at
  BEFORE UPDATE ON public.delivery_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.delivery_methods IS
  'Localized delivery fulfillment channels (digital gallery, USB, etc.) used when seeding org defaults.';

-- Seed delivery_methods from legacy package_delivery_methods if data exists
INSERT INTO public.delivery_methods (
  organization_id,
  user_id,
  slug,
  name,
  description,
  sort_order,
  is_active,
  created_at,
  updated_at
)
SELECT
  pdm.organization_id,
  pdm.user_id,
  lower(regexp_replace(coalesce(pdm.name, 'delivery'), '[^a-z0-9]+', '_', 'g')),
  pdm.name,
  pdm.description,
  pdm.sort_order,
  pdm.is_active,
  pdm.created_at,
  pdm.updated_at
FROM public.package_delivery_methods AS pdm
ON CONFLICT (organization_id, slug) DO NOTHING;
