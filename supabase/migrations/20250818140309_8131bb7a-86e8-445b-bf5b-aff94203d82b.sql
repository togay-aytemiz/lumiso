-- Add missing organization members for invited users
INSERT INTO organization_members (organization_id, user_id, role, invited_by)
VALUES 
  ('ac32273e-af95-4de9-abed-ce96e6f68139', 'be7d15eb-2594-4a63-b368-357e81a918e6', 'Member', 'ac32273e-af95-4de9-abed-ce96e6f68139'),
  ('ac32273e-af95-4de9-abed-ce96e6f68139', '1f2d87bb-d535-4fb0-90a3-f9e795c36e43', 'Member', 'ac32273e-af95-4de9-abed-ce96e6f68139'),
  ('ac32273e-af95-4de9-abed-ce96e6f68139', '31e4e0bb-f18d-44d8-8976-72164efa306a', 'Member', 'ac32273e-af95-4de9-abed-ce96e6f68139'),
  ('ac32273e-af95-4de9-abed-ce96e6f68139', 'c29d94e3-c574-431e-a4d9-fb570638c558', 'Member', 'ac32273e-af95-4de9-abed-ce96e6f68139'),
  ('ac32273e-af95-4de9-abed-ce96e6f68139', '793a16b9-b8b5-4680-8595-63d38a075d55', 'Member', 'ac32273e-af95-4de9-abed-ce96e6f68139')
ON CONFLICT (organization_id, user_id) DO NOTHING;