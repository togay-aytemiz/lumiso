-- Create a proper test session to trigger workflow with correct enum value
INSERT INTO sessions (
  user_id, 
  organization_id, 
  session_date,
  session_time,
  notes,
  location,
  status,
  project_id,
  lead_id
) VALUES (
  'ac32273e-af95-4de9-abed-ce96e6f68139',
  '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45',
  (now() + interval '1 day')::date,
  '14:00',
  'Test workflow session to verify email notifications are working',
  'Studio Location',
  'planned',
  (SELECT id FROM projects WHERE organization_id = '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45' LIMIT 1),
  (SELECT id FROM leads WHERE organization_id = '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45' LIMIT 1)
) RETURNING id;