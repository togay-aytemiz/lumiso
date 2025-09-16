-- Create languages table for supported languages
CREATE TABLE public.languages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE, -- ISO 639-1 codes (en, tr, es, etc.)
  name TEXT NOT NULL, -- Display name (English, Türkçe, Español)
  native_name TEXT NOT NULL, -- Native name (English, Türkçe, Español)
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create translation namespaces table
CREATE TABLE public.translation_namespaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- common, dashboard, forms, navigation, messages
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create translation keys table
CREATE TABLE public.translation_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  namespace_id UUID NOT NULL REFERENCES public.translation_namespaces(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL, -- button.save, form.email, etc.
  description TEXT, -- Helper text for translators
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(namespace_id, key_name)
);

-- Create translations table
CREATE TABLE public.translations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  language_code TEXT NOT NULL REFERENCES public.languages(code) ON DELETE CASCADE,
  key_id UUID NOT NULL REFERENCES public.translation_keys(id) ON DELETE CASCADE,
  value TEXT NOT NULL, -- The actual translated text
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(language_code, key_id)
);

-- Create user language preferences table
CREATE TABLE public.user_language_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  language_code TEXT NOT NULL REFERENCES public.languages(code) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_namespaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_language_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Languages - readable by all, manageable by admins
CREATE POLICY "Anyone can view languages" ON public.languages FOR SELECT USING (true);
CREATE POLICY "Admins can manage languages" ON public.languages FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Translation namespaces - readable by all, manageable by admins
CREATE POLICY "Anyone can view namespaces" ON public.translation_namespaces FOR SELECT USING (true);
CREATE POLICY "Admins can manage namespaces" ON public.translation_namespaces FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Translation keys - readable by all, manageable by admins
CREATE POLICY "Anyone can view translation keys" ON public.translation_keys FOR SELECT USING (true);
CREATE POLICY "Admins can manage translation keys" ON public.translation_keys FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Translations - readable by all, manageable by admins
CREATE POLICY "Anyone can view translations" ON public.translations FOR SELECT USING (true);
CREATE POLICY "Admins can manage translations" ON public.translations FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- User language preferences - users can manage their own
CREATE POLICY "Users can view their language preferences" ON public.user_language_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their language preferences" ON public.user_language_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all language preferences" ON public.user_language_preferences FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default languages
INSERT INTO public.languages (code, name, native_name, is_default, sort_order) VALUES
('en', 'English', 'English', true, 1),
('tr', 'Turkish', 'Türkçe', false, 2);

-- Insert default namespaces
INSERT INTO public.translation_namespaces (name, description) VALUES
('common', 'Common UI elements like buttons, labels, etc.'),
('dashboard', 'Dashboard specific content'),
('forms', 'Form labels, placeholders, and validation messages'),
('navigation', 'Menu items and navigation elements'),
('messages', 'Success, error, and info messages');

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_languages_updated_at BEFORE UPDATE ON public.languages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_translation_namespaces_updated_at BEFORE UPDATE ON public.translation_namespaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_translation_keys_updated_at BEFORE UPDATE ON public.translation_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_translations_updated_at BEFORE UPDATE ON public.translations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_language_preferences_updated_at BEFORE UPDATE ON public.user_language_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();