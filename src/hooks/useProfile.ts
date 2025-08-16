import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id?: string;
  user_id?: string;
  full_name?: string;
  phone_number?: string;
  profile_photo_url?: string;
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setProfile(data || { user_id: user.id });
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("No user found");

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
      return { success: true };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, error };
    }
  };

  const uploadProfilePhoto = async (file: File) => {
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("No user found");

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
      const { data: uploadData, error: uploadError } = await supabase.storage
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
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return {
    profile,
    loading,
    uploading,
    updateProfile,
    uploadProfilePhoto,
    refetch: fetchProfile
  };
}