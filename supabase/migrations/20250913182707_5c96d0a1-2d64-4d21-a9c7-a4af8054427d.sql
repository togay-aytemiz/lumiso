-- Enable RLS and add owner-managed policy for organization_settings
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization owners can manage organization settings" ON public.organization_settings;

CREATE POLICY "Organization owners can manage organization settings"
ON public.organization_settings
FOR ALL
USING (
  organization_id IN (
    SELECT o.id FROM public.organizations o WHERE o.owner_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT o.id FROM public.organizations o WHERE o.owner_id = auth.uid()
  )
);
