-- Deposit workflow cleanup: add allocation column, persist snapshot metadata, and retire legacy payment rows.

BEGIN;

-- 1. Track how much of a payment counts toward the deposit.
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS deposit_allocation NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Existing deposit payments fully count toward the deposit.
UPDATE public.payments
SET deposit_allocation = amount
WHERE type = 'deposit_payment';

-- 2. Persist the latest deposit schedule metadata on each project.
WITH latest_deposit_due AS (
  SELECT DISTINCT ON (project_id)
    project_id,
    amount,
    description,
    updated_at
  FROM public.payments
  WHERE type = 'deposit_due'
  ORDER BY project_id, updated_at DESC
)
UPDATE public.projects AS p
SET deposit_config =
  coalesce(p.deposit_config, '{}'::jsonb)
  || jsonb_build_object(
    'snapshot_amount', l.amount,
    'snapshot_note', l.description,
    'snapshot_locked_at', l.updated_at
  )
FROM latest_deposit_due AS l
WHERE p.id = l.project_id;

-- 3. Remove synthetic payment rows (base price + scheduled deposit).
DELETE FROM public.payments WHERE type IN ('deposit_due', 'base_price');

-- 4. Restrict payment types to the new set and keep manual as default.
ALTER TABLE public.payments
DROP CONSTRAINT IF EXISTS payments_type_check;

ALTER TABLE public.payments
ADD CONSTRAINT payments_type_check
CHECK (type IN ('manual', 'deposit_payment', 'balance_due'));

ALTER TABLE public.payments
ALTER COLUMN type SET DEFAULT 'manual';

COMMIT;
