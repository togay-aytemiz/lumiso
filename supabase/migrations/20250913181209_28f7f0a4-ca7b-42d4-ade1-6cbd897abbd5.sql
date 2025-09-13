-- Clean up assignee-related data from user preferences for single photographer mode

-- Remove assignee columns from lead table column preferences
UPDATE user_column_preferences 
SET column_config = (
  SELECT jsonb_agg(config)
  FROM jsonb_array_elements(column_config) AS config
  WHERE (config->>'key')::text != 'assignees'
)
WHERE table_name = 'leads' 
AND column_config::text LIKE '%assignees%';