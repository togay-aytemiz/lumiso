import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface LanguageContextType {
  currentLanguage: string;
  availableLanguages: Array<{
    code: string;
    name: string;
    native_name: string;
  }>;
  isLoading: boolean;
  changeLanguage: (languageCode: string) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'en');
  const [availableLanguages, setAvailableLanguages] = useState<Array<{
    code: string;
    name: string;
    native_name: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load available languages
  useEffect(() => {
    loadAvailableLanguages();
  }, []);

  // Load user's language preference
  useEffect(() => {
    if (user) {
      loadUserLanguagePreference();
    } else {
      // For non-authenticated users, use browser detection or default
      setIsLoading(false);
    }
  }, [user]);

  const loadAvailableLanguages = async () => {
    try {
      const { data: languages } = await supabase
        .from('languages')
        .select('code, name, native_name')
        .eq('is_active', true)
        .order('sort_order');

      if (languages) {
        setAvailableLanguages(languages);
      }
    } catch (error) {
      console.error('Error loading languages:', error);
    }
  };

  const loadUserLanguagePreference = async () => {
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
    } catch (error) {
      // No preference found, use browser detection or default
      console.log('No user language preference found');
    } finally {
      setIsLoading(false);
    }
  };

  const changeLanguageInternal = async (languageCode: string) => {
    try {
      await i18n.changeLanguage(languageCode);
      setCurrentLanguage(languageCode);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  const changeLanguage = async (languageCode: string) => {
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
            title: "Warning",
            description: "Language changed but preference not saved",
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Language Changed",
        description: `Interface language changed to ${languageCode.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Error changing language:', error);
      toast({
        title: "Error",
        description: "Failed to change language",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}