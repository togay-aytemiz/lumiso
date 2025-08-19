-- Create default project types for the current organization
-- This will ensure project types are visible immediately

INSERT INTO public.project_types (user_id, organization_id, name, is_default, sort_order) 
VALUES
  ('ac32273e-af95-4de9-abed-ce96e6f68139', '86b098a8-2fd5-4ad6-9dbf-757d656b307b', 'Corporate', false, 1),
  ('ac32273e-af95-4de9-abed-ce96e6f68139', '86b098a8-2fd5-4ad6-9dbf-757d656b307b', 'Event', false, 2),
  ('ac32273e-af95-4de9-abed-ce96e6f68139', '86b098a8-2fd5-4ad6-9dbf-757d656b307b', 'Family', false, 3),
  ('ac32273e-af95-4de9-abed-ce96e6f68139', '86b098a8-2fd5-4ad6-9dbf-757d656b307b', 'Maternity', false, 4),
  ('ac32273e-af95-4de9-abed-ce96e6f68139', '86b098a8-2fd5-4ad6-9dbf-757d656b307b', 'Newborn', true, 5),
  ('ac32273e-af95-4de9-abed-ce96e6f68139', '86b098a8-2fd5-4ad6-9dbf-757d656b307b', 'Portrait', false, 6),
  ('ac32273e-af95-4de9-abed-ce96e6f68139', '86b098a8-2fd5-4ad6-9dbf-757d656b307b', 'Wedding', false, 7),
  ('ac32273e-af95-4de9-abed-ce96e6f68139', '86b098a8-2fd5-4ad6-9dbf-757d656b307b', 'Other', false, 8)
ON CONFLICT (organization_id, name) DO NOTHING;