import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthContext';

interface Profile {
  id?: string;
  user_id?: string;
  full_name?: string;
  phone_number?: string;
  profile_photo_url?: string;
}

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  uploading: boolean;
  updateProfile: (updates: Partial<Profile>) => Promise<{ success: boolean; error?: any }>;
  uploadProfilePhoto: (file: File) => Promise<{ success: boolean; url?: string; error?: any }>;
  deleteProfilePhoto: () => Promise<{ success: boolean; error?: any }>;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

// Global cache to prevent duplicate requests
let profileCache: { profile: Profile | null; timestamp: number; userId: string } | null = null;
let ongoingProfileFetch: Promise<Profile | null> | null = null;
const PROFILE_CACHE_DURATION = 30000; // 30 seconds

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchProfile = useCallback(async (): Promise<Profile | null> => {
    if (!user?.id) return null;

    // Return cached profile if still fresh and for the same user
    if (
      profileCache && 
      profileCache.userId === user.id &&
      Date.now() - profileCache.timestamp < PROFILE_CACHE_DURATION
    ) {
      return profileCache.profile;
    }

    // If there's already an ongoing fetch for this user, wait for it
    if (ongoingProfileFetch) {
      return await ongoingProfileFetch;
    }

    try {
      // Create the fetch promise and store it
      ongoingProfileFetch = (async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        const profileData = data || { user_id: user.id };
        profileCache = { 
          profile: profileData, 
          timestamp: Date.now(), 
          userId: user.id 
        };
        return profileData;
      })();

      return await ongoingProfileFetch;
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
      return null;
    } finally {
      ongoingProfileFetch = null;
    }
  }, [user?.id, toast]);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    // Clear cache to force fresh fetch
    profileCache = null;
    const fetchedProfile = await fetchProfile();
    setProfile(fetchedProfile);
    setLoading(false);
  }, [fetchProfile, user?.id]);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user?.id) return { success: false, error: 'No user found' };

    try {
      let data, error;

      if (profile?.id) {
        // Update existing profile
        const result = await supabase
          .from('profiles')
          .update(updates)
          .eq('user_id', user.id)
          .select()
          .single();
        data = result.data;
        error = result.error;
      } else {
        // Insert new profile
        const result = await supabase
          .from('profiles')
          .insert({ ...updates, user_id: user.id })
          .select()
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      setProfile(data);
      // Update cache
      profileCache = { 
        profile: data, 
        timestamp: Date.now(), 
        userId: user.id 
      };
      return { success: true };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, error };
    }
  }, [profile?.id, user?.id]);

  const uploadProfilePhoto = useCallback(async (file: File) => {
    if (!user?.id) return { success: false, error: 'No user found' };

    try {
      setUploading(true);

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

      // Validate file size (2MB limit)
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('File size must be less than 2MB');
      }

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/profile-${Date.now()}.${fileExt}`;

      // Delete existing photo if it exists
      if (profile?.profile_photo_url) {
        const oldPath = profile.profile_photo_url.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('profile-photos')
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      // Update profile with new photo URL
      const updateResult = await updateProfile({ profile_photo_url: publicUrl });
      
      if (!updateResult.success) throw updateResult.error;

      toast({
        title: "Success",
        description: "Profile photo uploaded successfully",
      });

      return { success: true, url: publicUrl };
    } catch (error: any) {
      console.error('Error uploading profile photo:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload profile photo",
        variant: "destructive",
      });
      return { success: false, error };
    } finally {
      setUploading(false);
    }
  }, [user?.id, profile?.profile_photo_url, updateProfile, toast]);

  const deleteProfilePhoto = useCallback(async () => {
    if (!profile?.profile_photo_url) {
      return { success: true };
    }

    try {
      // Extract file path from URL
      const url = new URL(profile.profile_photo_url);
      const pathParts = url.pathname.split('/');
      const fileName = pathParts[pathParts.length - 1];

      // Delete the file from storage
      const { error: deleteError } = await supabase.storage
        .from('profile-photos')
        .remove([fileName]);

      if (deleteError) {
        console.error('Error deleting photo file:', deleteError);
        // Continue anyway to clear the URL from profile
      }

      // Update profile to remove photo URL
      const result = await updateProfile({ profile_photo_url: null });
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Profile photo deleted successfully",
        });
      }

      return result;
    } catch (error: any) {
      console.error('Error deleting profile photo:', error);
      toast({
        title: "Error", 
        description: error.message || "Failed to delete profile photo",
        variant: "destructive",
      });
      return { success: false, error };
    }
  }, [profile?.profile_photo_url, updateProfile, toast]);

  // Fetch profile when user changes
  useEffect(() => {
    if (user?.id) {
      const initializeProfile = async () => {
        const fetchedProfile = await fetchProfile();
        setProfile(fetchedProfile);
        setLoading(false);
      };
      initializeProfile();
    } else {
      setProfile(null);
      setLoading(false);
      profileCache = null; // Clear cache when user signs out
    }
  }, [user?.id, fetchProfile]);

  return (
    <ProfileContext.Provider value={{
      profile,
      loading,
      uploading,
      updateProfile,
      uploadProfilePhoto,
      deleteProfilePhoto,
      refreshProfile
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}