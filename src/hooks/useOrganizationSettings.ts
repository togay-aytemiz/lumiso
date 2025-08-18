import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface OrganizationSettings {
  id?: string;
  organization_id?: string;
  photography_business_name?: string | null;
  logo_url?: string | null;
  primary_brand_color?: string | null;
  date_format?: string | null;
  time_format?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const useOrganizationSettings = () => {
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  // Fetch organization settings
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user's active organization
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!userSettings?.active_organization_id) {
        setSettings(null);
        return;
      }

      // Get organization settings
      const { data: orgSettings, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('organization_id', userSettings.active_organization_id)
        .maybeSingle();

      if (error) throw error;

      setSettings(orgSettings);
    } catch (error) {
      console.error('Error fetching organization settings:', error);
      setSettings(null);
    } finally {
      setLoading(false);
    }
  };

  // Update organization settings
  const updateSettings = async (updates: Partial<OrganizationSettings>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user's active organization
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!userSettings?.active_organization_id) {
        throw new Error('No active organization found');
      }

      let result;
      if (settings?.id) {
        // Update existing settings
        result = await supabase
          .from('organization_settings')
          .update(updates)
          .eq('id', settings.id)
          .select()
          .single();
      } else {
        // Create new settings
        result = await supabase
          .from('organization_settings')
          .insert({
            organization_id: userSettings.active_organization_id,
            ...updates
          })
          .select()
          .single();
      }

      if (result.error) throw result.error;

      setSettings(result.data);
      return { success: true, data: result.data };
    } catch (error: any) {
      console.error('Error updating organization settings:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
      return { success: false, error };
    }
  };

  // Upload logo
  const uploadLogo = async (file: File) => {
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user's active organization
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!userSettings?.active_organization_id) {
        throw new Error('No active organization found');
      }

      // Delete existing logo if it exists
      if (settings?.logo_url) {
        const oldPath = settings.logo_url.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('logos').remove([oldPath]);
        }
      }

      // Upload new logo
      const fileExt = file.name.split('.').pop();
      const fileName = `${userSettings.active_organization_id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      // Update settings with new logo URL
      const updateResult = await updateSettings({ logo_url: publicUrl });
      
      if (updateResult.success) {
        toast({
          title: "Success",
          description: "Logo uploaded successfully",
        });
      }

      return updateResult;
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

  // Delete logo
  const deleteLogo = async () => {
    try {
      if (!settings?.logo_url) return { success: true };

      // Delete from storage
      const oldPath = settings.logo_url.split('/').pop();
      if (oldPath) {
        await supabase.storage.from('logos').remove([oldPath]);
      }

      // Clear the logo URL in settings
      const result = await updateSettings({ logo_url: null });
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Logo removed successfully",
        });
      }

      return result;
    } catch (error: any) {
      console.error('Error deleting logo:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete logo",
        variant: "destructive",
      });
      return { success: false, error };
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    uploading,
    updateSettings,
    uploadLogo,
    deleteLogo,
    refreshSettings: fetchSettings
  };
};