import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

// Import existing translation files
import enCommon from '@/i18n/resources/en/common.json';
import enDashboard from '@/i18n/resources/en/dashboard.json';
import enForms from '@/i18n/resources/en/forms.json';
import enNavigation from '@/i18n/resources/en/navigation.json';
import enMessages from '@/i18n/resources/en/messages.json';

import trCommon from '@/i18n/resources/tr/common.json';
import trDashboard from '@/i18n/resources/tr/dashboard.json';
import trForms from '@/i18n/resources/tr/forms.json';
import trNavigation from '@/i18n/resources/tr/navigation.json';
import trMessages from '@/i18n/resources/tr/messages.json';

const translations = {
  en: {
    common: enCommon,
    dashboard: enDashboard,
    forms: enForms,
    navigation: enNavigation,
    messages: enMessages,
  },
  tr: {
    common: trCommon,
    dashboard: trDashboard,
    forms: trForms,
    navigation: trNavigation,
    messages: trMessages,
  },
};

export const useTranslationFiles = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  const downloadLanguageFile = (languageCode: string, namespace: string) => {
    try {
      const data = translations[languageCode as keyof typeof translations]?.[namespace as keyof typeof translations.en];
      if (!data) {
        toast({
          title: "Error",
          description: `Translation file for ${languageCode}/${namespace} not found`,
          variant: "destructive",
        });
        return;
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${languageCode}-${namespace}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Downloaded ${languageCode}/${namespace}.json`,
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "Failed to download translation file",
        variant: "destructive",
      });
    }
  };

  const downloadLanguagePack = (languageCode: string) => {
    try {
      const languageData = translations[languageCode as keyof typeof translations];
      if (!languageData) {
        toast({
          title: "Error",
          description: `Language pack for ${languageCode} not found`,
          variant: "destructive",
        });
        return;
      }

      // Create a zip-like structure with multiple files
      const files: { [key: string]: any } = {};
      Object.entries(languageData).forEach(([namespace, data]) => {
        files[`${namespace}.json`] = data;
      });

      // For now, download as a single combined file
      // In a real app, you might want to create an actual zip file
      const blob = new Blob([JSON.stringify(files, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${languageCode}-language-pack.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Downloaded ${languageCode} language pack`,
      });
    } catch (error) {
      console.error('Error downloading language pack:', error);
      toast({
        title: "Error",
        description: "Failed to download language pack",
        variant: "destructive",
      });
    }
  };

  const downloadAllTranslations = () => {
    try {
      const blob = new Blob([JSON.stringify(translations, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'all-translations.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Downloaded all translations",
      });
    } catch (error) {
      console.error('Error downloading all translations:', error);
      toast({
        title: "Error",
        description: "Failed to download translations",
        variant: "destructive",
      });
    }
  };

  const uploadTranslationFile = async (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      setIsProcessing(true);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          
          // Validate the structure
          if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('Invalid JSON structure');
          }

          // TODO: Here you would save the file to the project
          // For now, we'll just validate and show a success message
          console.log('Parsed translation file:', parsed);
          
          toast({
            title: "Success",
            description: `Translation file ${file.name} processed successfully. Note: File saving not implemented yet.`,
          });
          
          setIsProcessing(false);
          resolve(true);
        } catch (error) {
          console.error('Error processing file:', error);
          toast({
            title: "Error",
            description: `Failed to process ${file.name}. Please check the file format.`,
            variant: "destructive",
          });
          setIsProcessing(false);
          resolve(false);
        }
      };
      
      reader.onerror = () => {
        toast({
          title: "Error",
          description: "Failed to read file",
          variant: "destructive",
        });
        setIsProcessing(false);
        resolve(false);
      };
      
      reader.readAsText(file);
    });
  };

  const getAvailableLanguages = () => Object.keys(translations);
  const getAvailableNamespaces = () => Object.keys(translations.en);
  
  const getTranslationStats = () => {
    const stats: { [key: string]: { [key: string]: number } } = {};
    
    Object.entries(translations).forEach(([langCode, langData]) => {
      stats[langCode] = {};
      Object.entries(langData).forEach(([namespace, nsData]) => {
        stats[langCode][namespace] = countKeys(nsData);
      });
    });
    
    return stats;
  };

  const countKeys = (obj: any): number => {
    let count = 0;
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        count += countKeys(obj[key]);
      } else {
        count++;
      }
    }
    return count;
  };

  return {
    downloadLanguageFile,
    downloadLanguagePack,
    downloadAllTranslations,
    uploadTranslationFile,
    getAvailableLanguages,
    getAvailableNamespaces,
    getTranslationStats,
    isProcessing,
  };
};