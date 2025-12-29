import React, { useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthContext';
import { ProfileContext } from './profile-context';
import type { Profile } from './profile-context';
import { useTranslation } from 'react-i18next';
import { useConnectivity } from './useConnectivity';
import { isNetworkError } from '@/lib/utils';

// Global cache to prevent duplicate requests
let profileCache: { profile: Profile | null; timestamp: number; userId: string } | null = null;
let ongoingProfileFetch: Promise<Profile | null> | null = null;
const PROFILE_CACHE_DURATION = 30000; // 30 seconds

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
};

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation(['pages', 'common']);
  const { reportNetworkError, reportRecovery } = useConnectivity();

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
        reportRecovery();
        return profileData;
      })();

      return await ongoingProfileFetch;
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (isNetworkError(error)) {
        reportNetworkError(error, 'service');
      }
      toast({
        title: t("common:toast.error", { defaultValue: "Error" }),
        description: t("settings.profile.toasts.loadError", {
          defaultValue: "Failed to load profile",
        }),
        variant: "destructive",
      });
      return null;
    } finally {
      ongoingProfileFetch = null;
    }
  }, [reportNetworkError, reportRecovery, t, toast, user?.id]);

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
    } catch (error: unknown) {
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
        title: t("common:toast.success", { defaultValue: "Success" }),
        description: t("settings.profile.toasts.photoUploadSuccess", {
          defaultValue: "Profile photo uploaded successfully",
        }),
      });

      return { success: true, url: publicUrl };
    } catch (error: unknown) {
      console.error('Error uploading profile photo:', error);
      toast({
        title: t("common:toast.error", { defaultValue: "Error" }),
        description:
          getErrorMessage(error) ||
          t("settings.profile.toasts.photoUploadError", {
            defaultValue: "Failed to upload profile photo",
          }),
        variant: "destructive",
      });
      return { success: false, error };
    } finally {
      setUploading(false);
    }
  }, [user?.id, profile?.profile_photo_url, updateProfile, toast, t]);

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
          title: t("common:toast.success", { defaultValue: "Success" }),
          description: t("settings.profile.toasts.photoDeleteSuccess", {
            defaultValue: "Profile photo deleted successfully",
          }),
        });
      }

      return result;
    } catch (error: unknown) {
      console.error('Error deleting profile photo:', error);
      toast({
        title: t("common:toast.error", { defaultValue: "Error" }),
        description:
          getErrorMessage(error) ||
          t("settings.profile.toasts.photoDeleteError", {
            defaultValue: "Failed to delete profile photo",
          }),
        variant: "destructive",
      });
      return { success: false, error };
    }
  }, [profile?.profile_photo_url, updateProfile, toast, t]);

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
