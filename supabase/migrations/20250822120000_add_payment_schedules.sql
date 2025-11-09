-- Add entry_kind and scheduled amount tracking to payments
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS entry_kind TEXT NOT NULL DEFAULT 'recorded'
CHECK (entry_kind IN ('recorded', 'scheduled'));

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS scheduled_initial_amount NUMERIC(12,2);

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS scheduled_remaining_amount NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS payments_project_entry_kind_idx
ON public.payments (project_id, entry_kind);

-- Backfill entry_kind for existing rows
UPDATE public.payments
SET entry_kind = 'recorded'
WHERE entry_kind IS NULL;

-- Seed scheduled rows for projects that have a base price but no schedule yet
WITH project_totals AS (
  SELECT
    p.id,
    p.user_id,
    p.organization_id,
    COALESCE(p.base_price, 0) AS contract_total,
    COALESCE(SUM(CASE WHEN pay.entry_kind = 'recorded' AND pay.status = 'paid' THEN pay.amount ELSE 0 END), 0) AS collected
  FROM public.projects p
  LEFT JOIN public.payments pay
    ON pay.project_id = p.id
  GROUP BY p.id, p.user_id, p.organization_id, p.base_price
),
insert_candidates AS (
  SELECT
    pt.*,
    GREATEST(pt.contract_total - pt.collected, 0) AS remaining
  FROM project_totals pt
  WHERE pt.contract_total > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.payments scheduled
      WHERE scheduled.project_id = pt.id AND scheduled.entry_kind = 'scheduled'
    )
)
INSERT INTO public.payments (
  project_id,
  user_id,
  organization_id,
  amount,
  description,
  status,
  type,
  entry_kind,
  scheduled_initial_amount,
  scheduled_remaining_amount
)
SELECT
  ic.id,
  ic.user_id,
  ic.organization_id,
  ic.contract_total,
  'Outstanding balance',
  CASE WHEN ic.remaining > 0 THEN 'due' ELSE 'paid' END,
  'balance_due',
  'scheduled',
  ic.contract_total,
  ic.remaining
FROM insert_candidates ic;
