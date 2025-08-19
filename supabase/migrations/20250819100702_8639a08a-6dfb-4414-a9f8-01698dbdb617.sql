-- Create default project types for the current organization
-- This will ensure project types are visible immediately

INSERT INTO public.project_types (user_id, organization_id, name, is_default, sort_order) 
SELECT 
  'ac32273e-af95-4de9-abed-ce96e6f68139', 
  '86b098a8-2fd5-4ad6-9dbf-757d656b307b', 
  type_name, 
  is_def, 
  sort_ord
FROM (VALUES
  ('Corporate', false, 1),
  ('Event', false, 2),
  ('Family', false, 3),
  ('Maternity', false, 4),
  ('Newborn', true, 5),
  ('Portrait', false, 6),
  ('Wedding', false, 7),
  ('Other', false, 8)
) AS types(type_name, is_def, sort_ord)
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_types 
  WHERE organization_id = '86b098a8-2fd5-4ad6-9dbf-757d656b307b' 
  AND name = types.type_name
);