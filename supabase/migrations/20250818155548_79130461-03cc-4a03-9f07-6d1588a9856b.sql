-- Add test14 to the organization that contains the leads data
-- First, let's add the user to the organization with existing data
INSERT INTO organization_members (organization_id, user_id, system_role, role, status, invited_by)
VALUES (
  'ac32273e-af95-4de9-abed-ce96e6f68139',
  '65b09bf1-12fc-46a6-be34-ed9da53b6cfa', 
  'Member',
  'Member',
  'active',
  'ac32273e-af95-4de9-abed-ce96e6f68139'
)
ON CONFLICT DO NOTHING;

-- Update their active organization to the one with data
UPDATE user_settings 
SET active_organization_id = 'ac32273e-af95-4de9-abed-ce96e6f68139'
WHERE user_id = '65b09bf1-12fc-46a6-be34-ed9da53b6cfa';