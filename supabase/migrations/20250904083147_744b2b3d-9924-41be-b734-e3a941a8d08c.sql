-- Fix workflow template reference to use message_templates instead of email_templates
UPDATE workflow_steps 
SET action_config = jsonb_set(
  action_config, 
  '{template_id}', 
  to_jsonb((SELECT id::text FROM message_templates WHERE category = 'session_confirmation' ORDER BY created_at DESC LIMIT 1))
) 
WHERE workflow_id = '6c11988c-5283-416d-a9af-53709904d04e' AND action_config->>'template_id' IS NULL;