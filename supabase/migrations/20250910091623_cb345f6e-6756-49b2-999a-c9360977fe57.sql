-- Insert a test reminder for 2 minutes from now to verify the system works
INSERT INTO scheduled_session_reminders (
  organization_id,
  session_id,
  workflow_id,
  reminder_type,
  scheduled_for,
  status
) VALUES (
  '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45',
  'b13472d6-fdb9-4ed5-acb3-2c3422de5576',
  '1c0e5b4a-e203-4c56-a3a6-12681e799834',
  '1_day',
  NOW() + INTERVAL '2 minutes',
  'pending'
);