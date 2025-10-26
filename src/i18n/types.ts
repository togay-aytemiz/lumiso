export interface Language {
  id: string;
  code: string;
  name: string;
  native_name: string;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TranslationNamespace {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface TranslationKey {
  id: string;
  namespace_id: string;
  key_name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Translation {
  id: string;
  language_code: string;
  key_id: string;
  value: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserLanguagePreference {
  id: string;
  userId: string;
  languageCode: string;
}

export type TranslationNamespaceType =
  | 'common'
  | 'dashboard'
  | 'forms'
  | 'navigation'
  | 'messages'
  | 'pages'
  | 'sessionPlanning';
