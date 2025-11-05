-- Rework project payment schema: extend payment types, add deposit config, and support per-project service billing classification.

-- 1. Extend payments.type constraint to support new schedule entries.
ALTER TABLE public.payments
DROP CONSTRAINT IF EXISTS payments_type_check;

ALTER TABLE public.payments
ADD CONSTRAINT payments_type_check
CHECK (type IN ('base_price', 'manual', 'deposit_due', 'deposit_payment'));

ALTER TABLE public.payments
ALTER COLUMN type SET DEFAULT 'manual';

-- 2. Persist deposit configuration on projects to drive payment automation.
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS deposit_config JSONB DEFAULT '{}'::jsonb;

-- 3. Track whether a project service is included in the package price or billed as an add-on.
ALTER TABLE public.project_services
ADD COLUMN IF NOT EXISTS billing_type TEXT NOT NULL DEFAULT 'included'
CHECK (billing_type IN ('included', 'extra'));

UPDATE public.project_services AS ps
SET billing_type = CASE
  WHEN s.extra IS TRUE THEN 'extra'
  ELSE 'included'
END
FROM public.services AS s
WHERE ps.service_id = s.id;
