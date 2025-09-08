-- Fix broken template reference in existing workflow step
UPDATE workflow_steps 
SET action_config = jsonb_set(
  action_config,
  '{template_id}',
  '"8f6fff7c-c20a-438d-8f2d-dedbe4b38351"'
)
WHERE action_config->>'template_id' = 'b3f54fc6-547d-4067-88b8-51edd0dfdb41';