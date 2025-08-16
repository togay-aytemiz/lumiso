import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserSettings {
  id?: string;
  show_quick_status_buttons?: boolean;
  photography_business_name?: string;
  logo_url?: string;
  primary_brand_color?: string;
  date_format?: string;
  time_format?: string;
}

const defaultSettings: UserSettings = {
  show_quick_status_buttons: true,
  photography_business_name: "",
  logo_url: null,
  primary_brand_color: "#1EB29F",
  date_format: "DD/MM/YYYY",
  time_format: "12-hour"
};

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  // Fetch user settings
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // First ensure user settings exist
      const { error: ensureError } = await supabase.rpc('ensure_user_settings', {
        user_uuid: user.id
      });

      if (ensureError) throw ensureError;

      // Then fetch the settings
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data);
      } else {
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Update user settings
  const updateSettings = async (updates: Partial<UserSettings>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("No user found");

      const { data, error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setSettings(data);
      return { success: true };
    } catch (error) {
      console.error('Error updating user settings:', error);
      return { success: false, error };
    }
  };

  // Upload logo file
  const uploadLogo = async (file: File) => {
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
      const fileName = `${user.id}/logo-${Date.now()}.${fileExt}`;

      // Delete existing logo if it exists
      if (settings?.logo_url) {
        const oldPath = settings.logo_url.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('logos')
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload new file
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      // Update settings with new logo URL
      const updateResult = await updateSettings({ logo_url: publicUrl });
      
      if (!updateResult.success) throw updateResult.error;

      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });

      return { success: true, url: publicUrl };
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
      return { success: false, error };
    } finally {
      setUploading(false);
    }
  };

  // Initialize settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    uploading,
    updateSettings,
    uploadLogo,
    refetch: fetchSettings
  };
}