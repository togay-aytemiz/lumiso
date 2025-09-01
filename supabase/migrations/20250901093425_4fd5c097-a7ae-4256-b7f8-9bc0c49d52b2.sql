-- Remove all sessions and reminders that were added for September-October 2025
-- since they appear to be duplicates or in wrong organization
DELETE FROM sessions 
WHERE session_date >= '2025-09-01' AND session_date <= '2025-10-31';

DELETE FROM activities 
WHERE type = 'reminder' 
  AND reminder_date >= '2025-09-01' 
  AND reminder_date <= '2025-10-31';