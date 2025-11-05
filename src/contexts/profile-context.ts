import { createContext } from 'react';

export interface Profile {
  id?: string;
  user_id?: string;
  full_name?: string;
  phone_number?: string;
  profile_photo_url?: string;
}

export interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  uploading: boolean;
  updateProfile: (updates: Partial<Profile>) => Promise<{ success: boolean; error?: unknown }>;
  uploadProfilePhoto: (file: File) => Promise<{ success: boolean; url?: string; error?: unknown }>;
  deleteProfilePhoto: () => Promise<{ success: boolean; error?: unknown }>;
  refreshProfile: () => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextType | undefined>(undefined);
