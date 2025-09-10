-- Schedule reminders for the September 17th session and check all reminders
SELECT public.schedule_session_reminders('ff71fd49-f50b-485f-a431-5653513b76e0');

-- Check all reminders for both test sessions
SELECT 
  sr.reminder_type,
  sr.scheduled_for AT TIME ZONE 'Europe/Istanbul' as scheduled_for_local,
  s.session_date,
  s.session_time,
  l.name as client_name,
  sr.status,
  w.name as workflow_name,
  -- Calculate days before session
  EXTRACT(EPOCH FROM (s.session_date + s.session_time - sr.scheduled_for))/86400 as days_before_session
FROM scheduled_session_reminders sr
JOIN sessions s ON sr.session_id = s.id
JOIN leads l ON s.lead_id = l.id
JOIN workflows w ON sr.workflow_id = w.id
WHERE s.id IN ('7608f543-5d9c-44c3-ad69-97b3bf76b46f', 'ff71fd49-f50b-485f-a431-5653513b76e0')
ORDER BY s.session_date, sr.scheduled_for;