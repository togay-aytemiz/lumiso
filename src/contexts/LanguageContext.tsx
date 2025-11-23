import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { LanguageContext, type LanguageContextType } from './languageShared';

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const { i18n, t } = useTranslation(["messages", "common"]);
  const { user } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'en');
  const [availableLanguages, setAvailableLanguages] = useState<Array<{
    code: string;
    name: string;
    native_name: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAvailableLanguages = useCallback(async () => {
    try {
      const { data: languages } = await supabase
        .from('languages')
        .select('code, name, native_name')
        .eq('is_active', true)
        .order('sort_order');

      if (languages) {
        setAvailableLanguages(languages);
      }
    } catch (error: unknown) {
      console.error('Error loading languages:', error);
    }
  }, []);

  const changeLanguageInternal = useCallback(async (languageCode: string) => {
    try {
      await i18n.changeLanguage(languageCode);
      setCurrentLanguage(languageCode);
    } catch (error: unknown) {
      console.error('Error changing language:', error);
    }
  }, [i18n]);

  const loadUserLanguagePreference = useCallback(async () => {
    if (!user) return;

    try {
      const { data: preference } = await supabase
        .from('user_language_preferences')
        .select('language_code')
        .eq('user_id', user.id)
        .single();

      if (preference?.language_code) {
        await changeLanguageInternal(preference.language_code);
      }
    } catch (error: unknown) {
      // No preference found, use browser detection or default
      console.info('No user language preference found');
    } finally {
      setIsLoading(false);
    }
  }, [changeLanguageInternal, user]);

  const changeLanguage = useCallback(async (languageCode: string) => {
    try {
      setIsLoading(true);
      
      // Change the i18n language
      await changeLanguageInternal(languageCode);

      // Save user preference if authenticated
      if (user) {
        const { error } = await supabase
          .from('user_language_preferences')
          .upsert({
            user_id: user.id,
            language_code: languageCode,
          }, {
            onConflict: 'user_id'
          });

        if (error) {
          console.error('Error saving language preference:', error);
          toast({
            title: t("toast.warning", { ns: "common" }),
            description: t("language.preferenceWarning", { ns: "messages" }),
            variant: "destructive",
          });
        }
      }

      toast({
        title: t("language.changeTitle", { ns: "messages" }),
        description: t("language.changeDescription", { ns: "messages", language: languageCode.toUpperCase() }),
      });
    } catch (error: unknown) {
      console.error('Error changing language:', error);
      toast({
        title: t("toast.error", { ns: "common" }),
        description: t("language.changeError", { ns: "messages" }),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [changeLanguageInternal, user]);

  // Load available languages
  useEffect(() => {
    loadAvailableLanguages();
  }, [loadAvailableLanguages]);

  // Load user's language preference
  useEffect(() => {
    if (user) {
      loadUserLanguagePreference();
    } else {
      // For non-authenticated users, use browser detection or default
      setIsLoading(false);
    }
  }, [user, loadUserLanguagePreference]);

  const value: LanguageContextType = {
    currentLanguage,
    availableLanguages,
    isLoading,
    changeLanguage,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export default LanguageProvider;
