import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

// Import existing translation files
import enCommon from '@/i18n/resources/en/common.json';
import enDashboard from '@/i18n/resources/en/dashboard.json';
import enForms from '@/i18n/resources/en/forms.json';
import enNavigation from '@/i18n/resources/en/navigation.json';
import enMessages from '@/i18n/resources/en/messages.json';
import enPages from '@/i18n/resources/en/pages.json';

import trCommon from '@/i18n/resources/tr/common.json';
import trDashboard from '@/i18n/resources/tr/dashboard.json';
import trForms from '@/i18n/resources/tr/forms.json';
import trNavigation from '@/i18n/resources/tr/navigation.json';
import trMessages from '@/i18n/resources/tr/messages.json';
import trPages from '@/i18n/resources/tr/pages.json';

const translations = {
  en: {
    common: enCommon,
    dashboard: enDashboard,
    forms: enForms,
    navigation: enNavigation,
    messages: enMessages,
    pages: enPages,
  },
  tr: {
    common: trCommon,
    dashboard: trDashboard,
    forms: trForms,
    navigation: trNavigation,
    messages: trMessages,
    pages: trPages,
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

  const uploadTranslationFile = async (file: File, onFileWrite?: (filePath: string, content: string) => Promise<void>): Promise<boolean> => {
    return new Promise((resolve) => {
      setIsProcessing(true);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          
          // Validate the structure
          if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('Invalid JSON structure');
          }

          // Parse filename to determine language and namespace
          const fileName = file.name.replace('.json', '');
          let languageCode: string, namespace: string;
          
          if (fileName.includes('-')) {
            // Individual file format: en-common.json
            [languageCode, namespace] = fileName.split('-');
            
            // Validate language and namespace
            if (!['en', 'tr'].includes(languageCode)) {
              throw new Error(`Invalid language code: ${languageCode}. Supported: en, tr`);
            }
            
            if (!['common', 'dashboard', 'forms', 'navigation', 'messages', 'pages'].includes(namespace)) {
              throw new Error(`Invalid namespace: ${namespace}. Supported: common, dashboard, forms, navigation, messages, pages`);
            }

            // Write individual file
            if (onFileWrite) {
              const filePath = `src/i18n/resources/${languageCode}/${namespace}.json`;
              const fileContent = JSON.stringify(parsed, null, 2);
              await onFileWrite(filePath, fileContent);
            }
            
            // Update in-memory translations immediately
            if (translations[languageCode as keyof typeof translations]) {
              (translations[languageCode as keyof typeof translations] as any)[namespace] = parsed;
            }
            
            toast({
              title: "Success",
              description: `Translation file ${file.name} uploaded successfully`,
            });
            
          } else {
            // Language pack format: process each namespace in the file
            const match = fileName.match(/^([a-z]{2})(-language-pack)?$/);
            if (match) {
              languageCode = match[1];
              
              if (!['en', 'tr'].includes(languageCode)) {
                throw new Error(`Invalid language code: ${languageCode}. Supported: en, tr`);
              }
              
              // Handle language pack format
              if (typeof parsed === 'object' && Object.keys(parsed).some(key => key.includes('.json'))) {
                // Language pack format with .json keys
                for (const [fileKey, fileData] of Object.entries(parsed)) {
                  if (fileKey.endsWith('.json')) {
                    const ns = fileKey.replace('.json', '');
                    
                    if (!['common', 'dashboard', 'forms', 'navigation', 'messages', 'pages'].includes(ns)) {
                      console.warn(`Skipping invalid namespace: ${ns}`);
                      continue;
                    }
                    
                    if (onFileWrite) {
                      const filePath = `src/i18n/resources/${languageCode}/${ns}.json`;
                      const fileContent = JSON.stringify(fileData, null, 2);
                      await onFileWrite(filePath, fileContent);
                    }
                    
                    // Update in-memory translations
                    if (translations[languageCode as keyof typeof translations]) {
                      (translations[languageCode as keyof typeof translations] as any)[ns] = fileData;
                    }
                  }
                }
                
                toast({
                  title: "Success",
                  description: `Language pack ${fileName} uploaded successfully`,
                });
              } else {
                throw new Error('Invalid language pack format');
              }
            } else {
              throw new Error('Invalid file name format. Use: en-common.json or en-language-pack.json');
            }
          }
          
          setIsProcessing(false);
          resolve(true);
        } catch (error) {
          console.error('Error processing file:', error);
          toast({
            title: "Error",
            description: `Failed to process ${file.name}. ${error instanceof Error ? error.message : 'Please check the file format.'}`,
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