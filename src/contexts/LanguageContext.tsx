import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { LanguageContext, type LanguageContextType } from './languageShared';

const FALLBACK_LANGUAGE = 'en';

const normalizeLanguageCode = (
  languageCode?: string,
  availableCodes: string[] = []
): string => {
  if (!languageCode) {
    return availableCodes[0] ?? FALLBACK_LANGUAGE;
  }

  const normalizedAvailable = availableCodes.map(code => code.toLowerCase());
  const lowerCased = languageCode.toLowerCase();
  const primary = lowerCased.split('-')[0];
  const candidates = Array.from(new Set([primary, lowerCased].filter(Boolean)));

  for (const code of candidates) {
    if (normalizedAvailable.length === 0 || normalizedAvailable.includes(code)) {
      return code;
    }
  }

  if (normalizedAvailable.includes(FALLBACK_LANGUAGE)) {
    return FALLBACK_LANGUAGE;
  }

  return normalizedAvailable[0] ?? FALLBACK_LANGUAGE;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const { i18n, t } = useTranslation(["messages", "common"]);
  const { user } = useAuth();
  const userId = user?.id;
  const [availableLanguages, setAvailableLanguages] = useState<Array<{
    code: string;
    name: string;
    native_name: string;
  }>>([]);
  const [currentLanguage, setCurrentLanguage] = useState(() =>
    normalizeLanguageCode(i18n.language || FALLBACK_LANGUAGE)
  );
  const [isLoading, setIsLoading] = useState(true);
  const preferenceLoadedForUser = useRef<string | null>(null);

  const normalizeLanguage = useCallback(
    (languageCode?: string) => normalizeLanguageCode(
      languageCode,
      availableLanguages.map(language => language.code.toLowerCase())
    ),
    [availableLanguages]
  );

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
    const normalizedLanguage = normalizeLanguage(languageCode);
    try {
      await i18n.changeLanguage(normalizedLanguage);
      setCurrentLanguage(normalizedLanguage);
    } catch (error: unknown) {
      console.error('Error changing language:', error);
    }
  }, [i18n, normalizeLanguage]);

  const persistUserLanguagePreference = useCallback(async (
    userId: string,
    languageCode: string,
    options?: { showToastOnError?: boolean }
  ) => {
    const { error } = await supabase
      .from('user_language_preferences')
      .upsert({
        user_id: userId,
        language_code: languageCode,
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error saving language preference:', error);
      if (options?.showToastOnError) {
        toast({
          title: t("toast.warning", { ns: "common" }),
          description: t("language.preferenceWarning", { ns: "messages" }),
          variant: "destructive",
        });
      }
    }
  }, [t]);

  const loadUserLanguagePreference = useCallback(async (userId: string) => {
    try {
      const { data: preference } = await supabase
        .from('user_language_preferences')
        .select('language_code')
        .eq('user_id', userId)
        .maybeSingle();

      if (preference?.language_code) {
        const normalizedPreference = normalizeLanguage(preference.language_code);
        await changeLanguageInternal(normalizedPreference);

        if (normalizedPreference !== preference.language_code) {
          await persistUserLanguagePreference(userId, normalizedPreference);
        }
      } else {
        const detectedLanguage = normalizeLanguage(
          i18n.language ||
          (typeof navigator !== 'undefined' ? navigator.language : FALLBACK_LANGUAGE)
        );

        await changeLanguageInternal(detectedLanguage);
        await persistUserLanguagePreference(userId, detectedLanguage);
      }
    } catch (error: unknown) {
      // No preference found, use browser detection or default
      console.info('No user language preference found');
    } finally {
      setIsLoading(false);
    }
  }, [changeLanguageInternal, i18n.language, normalizeLanguage, persistUserLanguagePreference]);

  const changeLanguage = useCallback(async (languageCode: string) => {
    const normalizedLanguage = normalizeLanguage(languageCode);

    try {
      setIsLoading(true);
      
      // Change the i18n language
      await changeLanguageInternal(normalizedLanguage);

      // Save user preference if authenticated
      if (userId) {
        await persistUserLanguagePreference(userId, normalizedLanguage, { showToastOnError: true });
      }

      toast({
        title: t("language.changeTitle", { ns: "messages" }),
        description: t("language.changeDescription", { ns: "messages", language: normalizedLanguage.toUpperCase() }),
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
  }, [changeLanguageInternal, normalizeLanguage, persistUserLanguagePreference, t, userId]);

  // Load available languages
  useEffect(() => {
    loadAvailableLanguages();
  }, [loadAvailableLanguages]);

  // Load user's language preference
  useEffect(() => {
    if (!userId) {
      preferenceLoadedForUser.current = null;
      // For non-authenticated users, use browser detection or default
      setIsLoading(false);
      return;
    }

    if (preferenceLoadedForUser.current === userId) {
      // Prevent repeated preference fetches when the user object reference changes
      return;
    }

    preferenceLoadedForUser.current = userId;
    void loadUserLanguagePreference(userId);
  }, [loadUserLanguagePreference, userId]);

  useEffect(() => {
    if (!availableLanguages.length) return;

    const normalized = normalizeLanguage(currentLanguage);
    if (normalized !== currentLanguage) {
      void changeLanguageInternal(normalized);
    }
  }, [availableLanguages, changeLanguageInternal, currentLanguage, normalizeLanguage]);

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
