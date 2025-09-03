-- Create a default session confirmation template for testing
INSERT INTO public.email_templates (
  user_id, 
  organization_id, 
  name, 
  description,
  subject,
  preheader,
  category,
  status,
  blocks
) 
SELECT 
  user_id,
  organization_id,
  'Session Confirmation - Default',
  'Default template for session confirmations sent via workflows',
  'Your {session_type} session is confirmed for {session_date}',
  'We look forward to seeing you!',
  'session_confirmation',
  'published',
  '[
    {
      "id": "header-1",
      "type": "text",
      "content": "Session Confirmed!",
      "style": {
        "fontSize": "24px",
        "fontWeight": "bold",
        "color": "#2563eb",
        "textAlign": "center",
        "marginBottom": "20px"
      }
    },
    {
      "id": "greeting-1", 
      "type": "text",
      "content": "Hi {customer_name},",
      "style": {
        "fontSize": "16px",
        "marginBottom": "16px"
      }
    },
    {
      "id": "confirmation-1",
      "type": "text", 
      "content": "Your session has been confirmed with the following details:",
      "style": {
        "fontSize": "16px",
        "marginBottom": "20px"
      }
    },
    {
      "id": "session-details-1",
      "type": "session-details",
      "content": "",
      "style": {
        "backgroundColor": "#f8fafc",
        "padding": "20px",
        "borderRadius": "8px",
        "marginBottom": "20px"
      }
    },
    {
      "id": "closing-1",
      "type": "text",
      "content": "Please arrive 10 minutes early. We look forward to capturing beautiful moments with you!",
      "style": {
        "fontSize": "16px",
        "marginBottom": "20px"
      }
    },
    {
      "id": "signature-1",
      "type": "text",
      "content": "Best regards,<br>{studio_name}",
      "style": {
        "fontSize": "16px"
      }
    }
  ]'::jsonb
FROM organization_members om
JOIN organizations o ON om.organization_id = o.id
WHERE om.system_role = 'Owner'
  AND NOT EXISTS (
    SELECT 1 FROM email_templates et 
    WHERE et.organization_id = om.organization_id 
    AND et.category = 'session_confirmation'
  );