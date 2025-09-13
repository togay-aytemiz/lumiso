-- Clean up assignee-related data from user preferences to fix single photographer mode

-- Remove assignee columns from lead table column preferences
UPDATE user_column_preferences 
SET column_config = (
  SELECT json_agg(
    CASE 
      WHEN (config->>'key')::text = 'assignees' THEN NULL
      ELSE config
    END
  ) FILTER (WHERE (config->>'key')::text != 'assignees')
  FROM json_array_elements(column_config) AS config
)
WHERE table_name = 'leads' 
AND EXISTS (
  SELECT 1 FROM json_array_elements(column_config) AS config 
  WHERE (config->>'key')::text = 'assignees'
);