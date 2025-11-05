import { createContext, useContext } from "react";

export interface LanguageContextType {
  currentLanguage: string;
  availableLanguages: Array<{
    code: string;
    name: string;
    native_name: string;
  }>;
  isLoading: boolean;
  changeLanguage: (languageCode: string) => Promise<void>;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
