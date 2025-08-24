-- Create message templates table for master template content
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL, -- e.g. "Session Confirmation", "Session Reminder"  
  category TEXT NOT NULL, -- "session_confirmation", "session_reminder", "session_rescheduled", "session_cancelled", "session_completed"
  master_content TEXT NOT NULL, -- Main message content
  placeholders JSONB DEFAULT '[]'::jsonb, -- Available placeholders for this template
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL -- Creator of the template
);

-- Create template channel views for Email, SMS, WhatsApp variations
CREATE TABLE public.template_channel_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.message_templates(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- "email", "whatsapp", "sms"
  content TEXT, -- If NULL, inherits from master_content
  html_content TEXT, -- For email HTML version
  subject TEXT, -- For email subject line
  metadata JSONB DEFAULT '{}'::jsonb, -- Channel-specific settings (buttons, formatting, etc.)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(template_id, channel) -- One view per channel per template
);

-- Enhanced silent hours configuration (replacing existing system)
CREATE TABLE public.silent_hours_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  channel TEXT NOT NULL, -- "email", "whatsapp", "sms", "all"
  enabled BOOLEAN NOT NULL DEFAULT true,
  start_time TIME NOT NULL DEFAULT '22:00',
  end_time TIME NOT NULL DEFAULT '08:00',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, channel) -- One config per channel per organization
);

-- Enable RLS on all tables
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_channel_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.silent_hours_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_templates
CREATE POLICY "Organization members can view templates" 
ON public.message_templates FOR SELECT 
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can create templates" 
ON public.message_templates FOR INSERT 
WITH CHECK (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can update templates" 
ON public.message_templates FOR UPDATE 
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can delete templates" 
ON public.message_templates FOR DELETE 
USING (organization_id = get_user_active_organization_id());

-- RLS policies for template_channel_views
CREATE POLICY "Organization members can view template channel views" 
ON public.template_channel_views FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.message_templates mt 
  WHERE mt.id = template_channel_views.template_id 
  AND mt.organization_id = get_user_active_organization_id()
));

CREATE POLICY "Organization members can create template channel views" 
ON public.template_channel_views FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.message_templates mt 
  WHERE mt.id = template_channel_views.template_id 
  AND mt.organization_id = get_user_active_organization_id()
));

CREATE POLICY "Organization members can update template channel views" 
ON public.template_channel_views FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.message_templates mt 
  WHERE mt.id = template_channel_views.template_id 
  AND mt.organization_id = get_user_active_organization_id()
));

CREATE POLICY "Organization members can delete template channel views" 
ON public.template_channel_views FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.message_templates mt 
  WHERE mt.id = template_channel_views.template_id 
  AND mt.organization_id = get_user_active_organization_id()
));

-- RLS policies for silent_hours_config
CREATE POLICY "Organization members can view silent hours config" 
ON public.silent_hours_config FOR SELECT 
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can create silent hours config" 
ON public.silent_hours_config FOR INSERT 
WITH CHECK (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can update silent hours config" 
ON public.silent_hours_config FOR UPDATE 
USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can delete silent hours config" 
ON public.silent_hours_config FOR DELETE 
USING (organization_id = get_user_active_organization_id());

-- Create function to seed default templates for new organizations
CREATE OR REPLACE FUNCTION public.ensure_default_message_templates(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  template_count INTEGER;
  confirmation_template_id UUID;
  reminder_template_id UUID;
  rescheduled_template_id UUID;
  cancelled_template_id UUID;
  completed_template_id UUID;
BEGIN
  -- Check if organization already has templates
  SELECT COUNT(*) INTO template_count 
  FROM public.message_templates 
  WHERE organization_id = org_id;
  
  -- Only create defaults if no templates exist
  IF template_count = 0 THEN
    -- Session Confirmation Template
    INSERT INTO public.message_templates (user_id, organization_id, name, category, master_content, placeholders)
    VALUES (
      user_uuid, 
      org_id, 
      'Session Confirmation', 
      'session_confirmation',
      'Hi {customer_name}! Your {session_type} session is confirmed for {session_date} at {session_time}. Location: {session_location}. Looking forward to capturing beautiful moments with you!',
      '["customer_name", "session_type", "session_date", "session_time", "session_location", "studio_name", "studio_phone"]'::jsonb
    ) RETURNING id INTO confirmation_template_id;
    
    -- Session Reminder Template  
    INSERT INTO public.message_templates (user_id, organization_id, name, category, master_content, placeholders)
    VALUES (
      user_uuid, 
      org_id, 
      'Session Reminder', 
      'session_reminder',
      'Hi {customer_name}! Just a friendly reminder about your {session_type} session tomorrow at {session_time}. Location: {session_location}. Please arrive 10 minutes early. Can''t wait to see you!',
      '["customer_name", "session_type", "session_date", "session_time", "session_location", "studio_name", "studio_phone"]'::jsonb
    ) RETURNING id INTO reminder_template_id;
    
    -- Session Rescheduled Template
    INSERT INTO public.message_templates (user_id, organization_id, name, category, master_content, placeholders)  
    VALUES (
      user_uuid, 
      org_id, 
      'Session Rescheduled', 
      'session_rescheduled',
      'Hi {customer_name}! Your {session_type} session has been rescheduled to {session_date} at {session_time}. Location: {session_location}. Thank you for your flexibility!',
      '["customer_name", "session_type", "session_date", "session_time", "session_location", "studio_name", "studio_phone"]'::jsonb
    ) RETURNING id INTO rescheduled_template_id;
    
    -- Session Cancelled Template
    INSERT INTO public.message_templates (user_id, organization_id, name, category, master_content, placeholders)
    VALUES (
      user_uuid, 
      org_id, 
      'Session Cancelled', 
      'session_cancelled',
      'Hi {customer_name}! Unfortunately, your {session_type} session scheduled for {session_date} has been cancelled. We apologize for any inconvenience. Please contact us to reschedule.',
      '["customer_name", "session_type", "session_date", "session_time", "studio_name", "studio_phone"]'::jsonb
    ) RETURNING id INTO cancelled_template_id;
    
    -- Session Completed Template
    INSERT INTO public.message_templates (user_id, organization_id, name, category, master_content, placeholders)
    VALUES (
      user_uuid, 
      org_id, 
      'Session Completed', 
      'session_completed',
      'Hi {customer_name}! Thank you for choosing {studio_name} for your {session_type} session. We had a wonderful time capturing your special moments! Your photos will be ready soon.',
      '["customer_name", "session_type", "studio_name", "studio_phone"]'::jsonb
    ) RETURNING id INTO completed_template_id;
    
    -- Create default channel views for each template
    -- Email channel views with HTML content
    INSERT INTO public.template_channel_views (template_id, channel, subject, content, html_content) VALUES
    (confirmation_template_id, 'email', 'Session Confirmed - {session_date}', 
     'Hi {customer_name}! Your {session_type} session is confirmed for {session_date} at {session_time}. Location: {session_location}. Looking forward to capturing beautiful moments with you!',
     '<p>Hi <strong>{customer_name}</strong>!</p><p>Your <strong>{session_type}</strong> session is confirmed for:</p><ul><li><strong>Date:</strong> {session_date}</li><li><strong>Time:</strong> {session_time}</li><li><strong>Location:</strong> {session_location}</li></ul><p>Looking forward to capturing beautiful moments with you!</p><p>Best regards,<br>{studio_name}</p>'),
    
    (reminder_template_id, 'email', 'Session Reminder - Tomorrow at {session_time}',
     'Hi {customer_name}! Just a friendly reminder about your {session_type} session tomorrow at {session_time}. Location: {session_location}. Please arrive 10 minutes early. Can''t wait to see you!',
     '<p>Hi <strong>{customer_name}</strong>!</p><p>Just a friendly reminder about your <strong>{session_type}</strong> session:</p><ul><li><strong>Date:</strong> Tomorrow</li><li><strong>Time:</strong> {session_time}</li><li><strong>Location:</strong> {session_location}</li></ul><p><strong>Please arrive 10 minutes early.</strong></p><p>Can''t wait to see you!</p><p>Best regards,<br>{studio_name}</p>');
    
    -- WhatsApp channel views (short and emoji-friendly)
    INSERT INTO public.template_channel_views (template_id, channel, content) VALUES
    (confirmation_template_id, 'whatsapp', 
     '📸 Hi {customer_name}! Your {session_type} session is confirmed for {session_date} at {session_time}. 📍 {session_location}. Looking forward to it! ✨'),
    
    (reminder_template_id, 'whatsapp',
     '⏰ Hi {customer_name}! Reminder: {session_type} session tomorrow at {session_time}. 📍 {session_location}. Please arrive 10 min early. See you soon! 📸'),
     
    (completed_template_id, 'whatsapp',
     '🙏 Thank you {customer_name}! We loved capturing your {session_type} session today. Your photos will be ready soon! ✨📸');
    
    -- SMS channel views (condensed)
    INSERT INTO public.template_channel_views (template_id, channel, content) VALUES
    (confirmation_template_id, 'sms',
     '{studio_name}: Hi {customer_name}! {session_type} confirmed for {session_date} at {session_time}. Location: {session_location}'),
    
    (reminder_template_id, 'sms', 
     '{studio_name}: Reminder - {session_type} tomorrow at {session_time}. {session_location}. Arrive 10 min early.'),
     
    (cancelled_template_id, 'sms',
     '{studio_name}: Hi {customer_name}, your {session_type} on {session_date} is cancelled. Contact us to reschedule.');
  END IF;
END;
$function$;

-- Add triggers for updated_at columns
CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_template_channel_views_updated_at
  BEFORE UPDATE ON public.template_channel_views
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_silent_hours_config_updated_at
  BEFORE UPDATE ON public.silent_hours_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();