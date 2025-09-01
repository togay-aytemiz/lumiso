-- Clean up duplicate sessions for September-October 2025
WITH duplicate_sessions AS (
  SELECT id, 
    ROW_NUMBER() OVER (
      PARTITION BY session_date, session_time, COALESCE(location, ''), lead_id, organization_id 
      ORDER BY created_at DESC
    ) as row_num
  FROM sessions 
  WHERE organization_id = (SELECT get_user_active_organization_id())
    AND session_date >= '2025-09-01' 
    AND session_date <= '2025-10-31'
)
DELETE FROM sessions 
WHERE id IN (
  SELECT id FROM duplicate_sessions WHERE row_num > 1
);

-- Clean up duplicate reminders for September-October 2025
WITH duplicate_reminders AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY reminder_date, COALESCE(reminder_time::text, ''), content, lead_id, organization_id
      ORDER BY created_at DESC  
    ) as row_num
  FROM activities 
  WHERE organization_id = (SELECT get_user_active_organization_id())
    AND type = 'reminder'
    AND reminder_date >= '2025-09-01' 
    AND reminder_date <= '2025-10-31'
)
DELETE FROM activities 
WHERE id IN (
  SELECT id FROM duplicate_reminders WHERE row_num > 1
);